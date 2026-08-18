import { ApprovalRequest } from '../types';

interface Props {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ApprovalQueue({ approvals, onApprove, onReject }: Props) {
  if (approvals.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
      <h3 className="font-semibold text-yellow-800 mb-3">Pending Approvals</h3>
      <div className="space-y-3">
        {approvals.map(req => (
          <div key={req.id} className="bg-white rounded-lg p-3 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{req.tool_name}</span>
              <span className="text-xs text-gray-500">{new Date(req.created_at * 1000).toLocaleTimeString()}</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">{req.context}</p>
            <pre className="text-xs bg-gray-50 rounded p-2 mb-2 overflow-x-auto">{JSON.stringify(req.arguments, null, 2)}</pre>
            <div className="flex gap-2">
              <button onClick={() => onApprove(req.id)} className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">
                Approve
              </button>
              <button onClick={() => onReject(req.id)} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
