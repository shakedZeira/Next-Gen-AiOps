import asyncio
import contextlib
import logging
import re
import threading

from pysnmp.carrier.asyncio.dgram import udp
from pysnmp.entity import config as snmp_config
from pysnmp.entity import engine as snmp_engine_module
from pysnmp.entity.rfc3413 import ntfrcv

from plugins.snmp_receiver.config import SnmpConfig
from plugins.snmp_receiver.trap_parser import parse_trap

logger = logging.getLogger("snmp_receiver")

MP_MODELS = {0: "v1", 1: "v2c", 3: "v3"}

AUTH_PROTO_NAMES = {
    "md5": "USM_AUTH_HMAC96_MD5",
    "sha": "USM_AUTH_HMAC96_SHA",
    "sha224": "USM_AUTH_HMAC128_SHA224",
    "sha256": "USM_AUTH_HMAC192_SHA256",
    "sha384": "USM_AUTH_HMAC256_SHA384",
    "sha512": "USM_AUTH_HMAC384_SHA512",
}

PRIV_PROTO_NAMES = {
    "des": "USM_PRIV_CBC56_DES",
    "3des": "USM_PRIV_CBC168_3DES",
    "aes128": "USM_PRIV_CFB128_AES",
    "aes192": "USM_PRIV_CFB192_AES",
    "aes256": "USM_PRIV_CFB256_AES",
}

_ADDR_RE = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3})[^0-9]*(\d+)")


def _attr(obj, *names):
    for name in names:
        attr = getattr(obj, name, None)
        if attr is not None:
            return attr
    raise AttributeError(f"None of {names} found on {type(obj).__name__}")


def _transport_address(snmp_engine, state_reference) -> tuple[str, int]:
    mdsp = getattr(snmp_engine, "message_dispatcher", None)
    if mdsp is None:
        mdsp = _attr(snmp_engine, "msg_and_pdu_dsp", "msgAndPduDsp")
    getter = None
    for name in ("get_transport_info", "getTransportInfo"):
        getter = getattr(mdsp, name, None)
        if getter:
            break
    if getter is None or state_reference is None:
        return "unknown", 0
    try:
        info = getter(state_reference)
        address = info[1]
        return str(address[0]), int(address[1])
    except Exception:
        pass
    try:
        info = getter(state_reference)
        match = _ADDR_RE.search(str(info[-1]))
        if match:
            return match.group(1), int(match.group(2))
    except Exception:
        pass
    return "unknown", 0


def _log_future_errors(future) -> None:
    error = future.exception()
    if error:
        logger.error("Trap processing failed: %s", error)


class VersionAwareNotificationReceiver(ntfrcv.NotificationReceiver):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_message_processing_model = None

    def process_pdu(self, snmpEngine, messageProcessingModel=None, *args, **kwargs):  # noqa: N802, N803
        self.last_message_processing_model = messageProcessingModel
        return super().process_pdu(snmpEngine, messageProcessingModel, *args, **kwargs)


class TrapUDPServer:
    def __init__(self, config: SnmpConfig, on_trap):
        self.config = config
        self.on_trap = on_trap
        self.snmp_engine = None
        self.dispatcher = None
        self.receiver = None
        self.main_loop = None
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def start(self) -> None:
        self.main_loop = asyncio.get_running_loop()
        self._thread = threading.Thread(
            target=self._worker, name="snmp-trap-dispatcher", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        if self.dispatcher is None:
            return
        with contextlib.suppress(Exception):
            _attr(self.dispatcher, "job_finished", "jobFinished")(1)
        with contextlib.suppress(Exception):
            _attr(self.dispatcher, "close_dispatcher", "closeDispatcher")()

    def _worker(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            self._build_engine()
            _attr(self.dispatcher, "job_started", "jobStarted")(1)
            logger.info("SNMP trap dispatcher running")
            _attr(self.dispatcher, "run_dispatcher", "runDispatcher")()
        except Exception:
            logger.exception("SNMP trap dispatcher crashed")

    def _build_engine(self) -> None:
        self.snmp_engine = snmp_engine_module.SnmpEngine()

        add_v1_system = _attr(snmp_config, "add_v1_system", "addV1System")
        for idx, community in enumerate(self.config.communities):
            add_v1_system(self.snmp_engine, f"community-{idx}", community)

        if self.config.SNMP_V3_USER:
            self._add_v3_user()

        domain = getattr(udp, "DOMAIN_NAME", None) or udp.domainName
        transport = udp.UdpTransport()
        transport.open_server_mode(
            (self.config.SNMP_BIND_HOST, self.config.SNMP_UDP_PORT)
        )
        add_transport = _attr(
            snmp_config, "add_transport", "addTransport", "add_socket_transport"
        )
        add_transport(self.snmp_engine, domain, transport)

        self.dispatcher = self.snmp_engine.transport_dispatcher or _attr(
            self.snmp_engine, "transportDispatcher"
        )
        self.receiver = VersionAwareNotificationReceiver(
            self.snmp_engine, self._on_notification
        )
        logger.info(
            "SNMP trap listener armed on udp/%s:%d communities=%s v3_user=%s",
            self.config.SNMP_BIND_HOST,
            self.config.SNMP_UDP_PORT,
            self.config.communities,
            self.config.SNMP_V3_USER or "-",
        )

    def _add_v3_user(self) -> None:
        add_v3_user = _attr(snmp_config, "add_v3_user", "addV3User")
        kwargs = {}
        if self.config.SNMP_V3_ENGINE_ID:
            from pysnmp.proto import rfc1902

            kwargs["securityEngineId"] = rfc1902.OctetString(
                hexValue=self.config.SNMP_V3_ENGINE_ID
            )

        auth_name = AUTH_PROTO_NAMES.get(self.config.SNMP_V3_AUTH_PROTO.lower())
        if not auth_name:
            raise ValueError(f"Unsupported SNMP_V3_AUTH_PROTO: {self.config.SNMP_V3_AUTH_PROTO}")
        auth_proto = getattr(snmp_config, auth_name)

        priv_proto = None
        if self.config.SNMP_V3_PRIV_KEY:
            priv_name = PRIV_PROTO_NAMES.get(self.config.SNMP_V3_PRIV_PROTO.lower())
            if not priv_name:
                raise ValueError(f"Unsupported SNMP_V3_PRIV_PROTO: {self.config.SNMP_V3_PRIV_PROTO}")
            priv_proto = getattr(snmp_config, priv_name)

        if priv_proto is not None:
            add_v3_user(
                self.snmp_engine,
                self.config.SNMP_V3_USER,
                auth_proto,
                self.config.SNMP_V3_AUTH_KEY or "",
                priv_proto,
                self.config.SNMP_V3_PRIV_KEY,
                **kwargs,
            )
        else:
            add_v3_user(
                self.snmp_engine,
                self.config.SNMP_V3_USER,
                auth_proto,
                self.config.SNMP_V3_AUTH_KEY or "",
                **kwargs,
            )

    def _on_notification(self, snmp_engine, state_reference, context_engine_id, context_name, var_binds, cb_ctx):
        version = MP_MODELS.get(self.receiver.last_message_processing_model, "unknown")
        source_ip, source_port = _transport_address(snmp_engine, state_reference)
        parsed = parse_trap(var_binds, source_ip, source_port, version)
        future = asyncio.run_coroutine_threadsafe(self.on_trap(parsed), self.main_loop)
        future.add_done_callback(_log_future_errors)
