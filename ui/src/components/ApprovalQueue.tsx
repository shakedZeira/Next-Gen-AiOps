import { ApprovalRequest } from '../types';

interface Props {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ApprovalQueue({ approvals, onApprove, onReject }: Props) {
  return (
    <div className="bg-white border rounded-xl p-4 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-3">Pending Approvals</h3>
      {approvals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No pending approvals
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {approvals.map(req => (
            <div key={req.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{req.tool_name}</span>
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  Pending
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{req.context}</p>
              <pre className="text-xs bg-white rounded border border-gray-200 p-2 mb-2 overflow-x-auto text-gray-700 max-h-32 overflow-y-auto">
                {JSON.stringify(req.arguments, null, 2)}
              </pre>
              <p className="text-xs text-gray-400 mb-2">
                {new Date(req.created_at * 1000).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(req.id)}
                  className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(req.id)}
                  className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
