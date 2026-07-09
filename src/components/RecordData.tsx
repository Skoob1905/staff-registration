import { RenderInfo } from "./RenderInfo";

interface RecordDataProps {
  data: Record<string, string>;
}

export const RecordData = ({ data }: RecordDataProps) => {
  const entries = Object.entries(data);

  return (
    <div className="overflow-x-auto">
      <div className="w-max grid grid-rows-[repeat(6,auto)] grid-flow-col auto-cols-min gap-x-6 gap-y-1 text-xs sm:text-sm text-zinc-600">
        {entries.map(([label, value], idx) => (
          <RenderInfo
            key={label}
            label={label}
            value={value}
            delay={idx * 12}
          />
        ))}
      </div>
    </div>
  );
};
