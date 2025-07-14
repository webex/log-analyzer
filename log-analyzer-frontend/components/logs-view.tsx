import { LogCard } from "./log-card";

export function LogsView({ results }: { results: any }) {

  return (
           <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {results?.map((hit: any, index: number) => (
            <LogCard key={hit._id || index} log={hit} />
          ))}
        </div>
  )
}