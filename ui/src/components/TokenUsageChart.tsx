import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function TokenUsageChart() {
  const data = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      { label: 'Input Tokens', data: [1200, 1900, 3000, 5000, 3500, 2800], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true },
      { label: 'Output Tokens', data: [800, 1200, 2000, 3200, 2200, 1800], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: 'top' as const }, title: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  return <Line data={data} options={options} />;
}
