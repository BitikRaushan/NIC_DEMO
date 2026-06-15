import { motion } from 'framer-motion';
import { RiGridLine, RiDownloadLine, RiNumbersLine } from 'react-icons/ri';

const STATUS_STYLES = {
  processing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  pending:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  completed:  'bg-green-500/10  text-green-400  border-green-500/25',
  delivered:  'bg-green-500/10  text-green-400  border-green-500/25',
  shipped:    'bg-neon-cyan/10  text-neon-cyan   border-neon-cyan/25',
  cancelled:  'bg-red-500/10   text-red-400    border-red-500/25',
  failed:     'bg-red-500/10   text-red-400    border-red-500/25',
  refunded:   'bg-orange-500/10 text-orange-400 border-orange-500/25',
};

const getStatusStyle = (val) =>
  STATUS_STYLES[val.toLowerCase()] ?? 'bg-theme-text/5 text-theme-muted border-theme-text/10';

const ResultTable = ({ queryResult }) => {
  const { columns = [], rows = [] } = queryResult;

  if (columns.length === 0 || rows.length === 0) return null;

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + [columns.join(","), ...rows.map(row => columns.map(col => `"${row[col]}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `querybridge_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="w-full max-w-3xl mx-auto mt-8 glass-panel-purple rounded-2xl p-6 border border-neon-purple/20 shadow-[0_0_30px_rgba(171,0,255,0.05)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme-text/10 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <RiGridLine className="text-xl text-neon-purple" />
          <div>
            <h4 className="font-display font-bold text-sm text-theme-text tracking-wide uppercase">
              Relational Output Buffer
            </h4>
            <p className="text-[10px] font-mono text-theme-dim mt-0.5">
              TABLE: <span className="text-neon-purple">DYNAMIC_RESULT_SET</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-theme-text/5 border border-theme-text/5 rounded-md px-2.5 py-1.5 text-[10px] font-mono text-theme-muted">
            <RiNumbersLine className="text-neon-purple" />
            <span>ROWS: <strong className="text-theme-text">{rows.length}</strong></span>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-text/5 hover:bg-neon-purple/20 border border-theme-text/10 hover:border-neon-purple/50 text-[10px] font-mono text-theme-muted hover:text-theme-text transition-all duration-200 cursor-pointer"
          >
            <RiDownloadLine className="text-xs" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-theme-text/10 bg-theme-code/15">
        <table className="w-full border-collapse text-left text-xs font-sans">
          <thead>
            <tr className="bg-theme-text/5 border-b border-neon-purple/15">
              {/* Row number header */}
              <th className="px-3 py-4 font-mono font-bold text-[10px] text-neon-purple/50 uppercase tracking-widest border-r border-theme-text/5 w-10 text-center">
                #
              </th>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-5 py-4 font-mono font-bold text-[10px] text-theme-text/70 uppercase tracking-widest border-r border-theme-text/5 last:border-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-theme-text/5">
            {rows.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIndex * 0.05, duration: 0.4 }}
                className="hover:bg-neon-purple/5 transition-all duration-250"
              >
                {/* Row number cell */}
                <td className="px-3 py-3.5 font-mono text-[10px] text-neon-purple/40 border-r border-theme-text/5 text-center select-none">
                  {rowIndex + 1}
                </td>

                {columns.map((column, colIndex) => {
                  const val = row[column];
                  const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);

                  return (
                    <td
                      key={colIndex}
                      className="px-5 py-3.5 text-theme-muted font-mono tracking-wide border-r border-theme-text/5 last:border-0"
                    >
                      {column.toLowerCase().includes('status') ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(valStr)}`}>
                          {valStr}
                        </span>
                      ) : column.toLowerCase().includes('email') ? (
                        <span className="text-neon-cyan/80">{valStr}</span>
                      ) : (
                        valStr
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ResultTable;
