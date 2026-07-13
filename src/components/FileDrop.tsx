import { type ElementType, useRef, useState } from "react";

interface FileDropProps {
  icon: ElementType;
  title: string;
  description: string;
  color: string;
  acceptedFiles?: string;
  fileLimit?: string;
  onClick?: () => void;
  onFileSelect?: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  multiple?: boolean;
  feint?: boolean;
  noScale?: boolean;
  disabled?: boolean;
  progress?: { completed: number; total: number };
}

export const FileDrop = ({
  icon: Icon,
  title,
  description,
  color,
  acceptedFiles,
  fileLimit,
  onClick,
  onFileSelect,
  onFilesSelect,
  multiple,
  feint,
  noScale,
  disabled,
  progress,
}: FileDropProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isDisabled = disabled ?? false;
  const hasFileHandler = !isDisabled && !!(onFileSelect ?? onFilesSelect);

  const handleFiles = (files: FileList | File[]) => {
    if (isDisabled) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (multiple && onFilesSelect) {
      onFilesSelect(arr);
    } else if (arr[0] && onFileSelect) {
      onFileSelect(arr[0]);
    }
  };

  const handleClick = () => {
    if (isDisabled) return;
    if (onClick) {
      onClick();
    } else if (hasFileHandler) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDisabled && hasFileHandler) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!isDisabled) handleFiles(e.dataTransfer.files);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      className={`aspect-square max-w-[300px] w-full rounded-2xl border-2 border-dashed p-4 sm:p-6 flex flex-col items-center justify-center gap-2 transition-all duration-200${
        noScale || isDisabled ? "" : " hover:scale-[1.02]"
      }${isDisabled ? " cursor-not-allowed" : " cursor-pointer"}`}
      style={{
        borderColor: isDisabled
          ? "#d1d5db"
          : feint
            ? hovered
              ? "#60a5fa"
              : "#93c5fd"
            : `${color}50`,
        backgroundColor: isDisabled
          ? "#f3f4f6"
          : feint
            ? hovered
              ? "#dbeafe"
              : "#eff6ff"
            : dragOver
              ? `${color}1A`
              : `${color}0D`,
        backgroundImage: feint && !isDisabled ? "rgba(147,197,253,0.45)" : undefined,
      }}
    >
      {progress && (
        <span className="text-[10px] sm:text-xs font-medium text-gray-400">
          {progress.completed} / {progress.total}
        </span>
      )}
      <Icon
        className="h-8 w-8 sm:h-10 sm:w-10"
        style={{ color: isDisabled ? "#9ca3af" : feint ? "#3b82f6" : color }}
      />
      <span
        className="text-xs sm:text-sm font-bold"
        style={{ color: isDisabled ? "#9ca3af" : feint ? "#3b82f6" : color }}
      >
        {title}
      </span>
      <span
        className={`text-[10px] sm:text-xs text-center leading-tight ${
          isDisabled ? "text-gray-400" : feint ? "text-[#6b7280]" : "text-zinc-500"
        }`}
      >
        {description}
      </span>
      {(acceptedFiles ?? fileLimit) && (
        <span
          className={`text-[10px] sm:text-xs text-center leading-tight ${
            isDisabled ? "text-gray-400" : feint ? "text-[#6b7280]" : "text-zinc-400"
          }`}
        >
          ({[acceptedFiles, fileLimit].filter(Boolean).join(", ")})
        </span>
      )}
      {hasFileHandler && (
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFiles}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files ?? [])}
        />
      )}
    </div>
  );
};
