export default function AvailabilityDetails({ members, availability, surveyDates }) {
  if (!surveyDates || surveyDates.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>No selectable dates set yet. The trip owner needs to set a date range.</p>
      </div>
    );
  }

  // Format a date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Member</th>
            {surveyDates.map((date) => (
              <th key={date} className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                <div className="text-xs">{formatDate(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const memberAvailability = availability[member.id] || [];
            return (
              <tr key={member.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-ink">
                  <div className="flex items-center gap-2">
                    <span>{member.name}</span>
                    {member.isLeader && (
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#4C6FFF]">
                        Leader
                      </span>
                    )}
                  </div>
                </td>
                {surveyDates.map((date) => {
                  const isAvailable = memberAvailability.includes(date);
                  return (
                    <td key={`${member.id}-${date}`} className="px-3 py-3 text-center">
                      {isAvailable ? (
                        <div className="flex justify-center">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#6BCB77] text-white text-sm font-bold">
                            ✓
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#F56565] text-white text-sm font-bold">
                            ✗
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
