import uuid

from aiops_shared.models.ci import CI
from aiops_shared.models.relationship import Relationship


def test_ci_creation():
    ci = CI(name="web-server-1", type="host", provider="aws")
    assert ci.name == "web-server-1"
    assert ci.type == "host"


def test_relationship_creation():
    rel = Relationship(
        source_id=uuid.uuid4(),
        target_id=uuid.uuid4(),
        type="depends_on",
        discovered_by="tag",
    )
    assert rel.type == "depends_on"
