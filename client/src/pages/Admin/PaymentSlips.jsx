import Card from '../../components/ui/Card';

export default function PaymentSlips() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Payment Slips</h1>
      <Card>
        <p className="text-slate-600 text-sm">
          This section can be used to view and manage customer payment slips.
        </p>
        <p className="mt-3 text-slate-500 text-xs">
          (Placeholder page – no data yet.)
        </p>
      </Card>
    </div>
  );
}

