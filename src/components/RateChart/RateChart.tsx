import type { RateEntry } from '../../types';
import styles from './RateChart.module.css';

interface RateChartProps {
  rateEntries: RateEntry[];
  favouriteTeam: string;
}

export function RateChart({ rateEntries, favouriteTeam }: RateChartProps) {
  if (rateEntries.length < 2) {
    return (
      <div className={styles.container}>
        <div className={styles.title}>Rate History</div>
        <div className={styles.noData}>
          Need at least 2 rate entries to show chart.
        </div>
      </div>
    );
  }

  const W = 320;
  const H = 140;
  const PAD = { top: 15, right: 15, bottom: 25, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const lagaaiRates = rateEntries.map((r) => r.lagaaiRate);
  const khaaiRates = rateEntries.map((r) => r.khaaiRate);
  const allRates = [...lagaaiRates, ...khaaiRates];
  const minR = Math.max(0, Math.min(...allRates) - 5);
  const maxR = Math.min(100, Math.max(...allRates) + 5);
  const range = maxR - minR || 1;

  const xStep = plotW / Math.max(1, rateEntries.length - 1);

  function toX(i: number) {
    return PAD.left + i * xStep;
  }
  function toY(val: number) {
    return PAD.top + plotH - ((val - minR) / range) * plotH;
  }

  const lagaaiPath = lagaaiRates
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(r).toFixed(1)}`)
    .join(' ');

  const khaaiPath = khaaiRates
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(r).toFixed(1)}`)
    .join(' ');

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minR + (range * i) / (yTicks - 1))
  );

  // Time labels
  const firstTime = new Date(rateEntries[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lastTime = new Date(rateEntries[rateEntries.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.container}>
      <div className={styles.title}>Rate History</div>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yLabels.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3"
            />
            <text x={PAD.left - 4} y={toY(v) + 3} textAnchor="end" fontSize="7" fill="var(--text-muted)">
              {v}
            </text>
          </g>
        ))}

        {/* Time labels */}
        <text x={PAD.left} y={H - 4} fontSize="7" fill="var(--text-muted)">{firstTime}</text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize="7" fill="var(--text-muted)">{lastTime}</text>

        {/* Lagaai line */}
        <path d={lagaaiPath} fill="none" stroke="#60a5fa" strokeWidth="2" />
        {/* Khaai line */}
        <path d={khaaiPath} fill="none" stroke="#f472b6" strokeWidth="2" />

        {/* Data points */}
        {lagaaiRates.map((r, i) => (
          <circle key={`l${i}`} cx={toX(i)} cy={toY(r)} r="2.5" fill="#60a5fa" />
        ))}
        {khaaiRates.map((r, i) => (
          <circle key={`k${i}`} cx={toX(i)} cy={toY(r)} r="2.5" fill="#f472b6" />
        ))}

        {/* Latest values */}
        <text
          x={toX(lagaaiRates.length - 1) + 4}
          y={toY(lagaaiRates[lagaaiRates.length - 1]) - 4}
          fontSize="8" fontWeight="700" fill="#60a5fa"
        >
          {lagaaiRates[lagaaiRates.length - 1]}
        </text>
        <text
          x={toX(khaaiRates.length - 1) + 4}
          y={toY(khaaiRates[khaaiRates.length - 1]) + 10}
          fontSize="8" fontWeight="700" fill="#f472b6"
        >
          {khaaiRates[khaaiRates.length - 1]}
        </text>
      </svg>

      <div className={styles.legend}>
        <span>
          <span className={styles.legendDot} style={{ background: '#60a5fa' }} />
          Lagaai ({favouriteTeam})
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: '#f472b6' }} />
          Khaai
        </span>
      </div>
    </div>
  );
}
