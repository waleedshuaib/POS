import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

export function PageHeader({
  title,
  right,
  helpSlug,
}: {
  title: string;
  right?: ReactNode;
  helpSlug?: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {helpSlug && (
          <Link to={`/help/${helpSlug}`} className="text-slate-400 hover:text-brand-600" title="Help">
            <HelpCircle size={18} />
          </Link>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
