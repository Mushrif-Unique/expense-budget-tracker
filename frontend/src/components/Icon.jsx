const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  transactions: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/></>,
  budget: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M7 3v4m10-4v4m-9 9h3"/></>,
  arrow: <><path d="M5 19 19 5M5 5h14v14"/></>,
  income: <><path d="M7 17 17 7M7 7h10v10"/></>,
  expense: <><path d="m7 7 10 10M7 17h10V7"/></>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-15 6 7-6 7m-6-7h12"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-5 4h5v4h-5zM6 5V3h12v2"/></>,
};
export default function Icon({ name, className = 'h-5 w-5' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.wallet}</svg>;
}
