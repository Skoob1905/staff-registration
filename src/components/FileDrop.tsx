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
}: FileDropProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const hasFileHandler = !!(onFileSelect ?? onFilesSelect);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (multiple && onFilesSelect) {
      onFilesSelect(arr);
    } else if (arr[0] && onFileSelect) {
      onFileSelect(arr[0]);
    }
  };

  const handleClick = () => {
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
        if (hasFileHandler) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={handleClick}
      className="aspect-square max-w-[300px] w-full cursor-pointer rounded-2xl border-2 border-dashed p-4 sm:p-6 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
      style={{
        borderColor: color,
        backgroundColor: dragOver ? `${color}20` : `${color}0D`,
      }}
    >
      <Icon className="h-8 w-8 sm:h-10 sm:w-10" style={{ color }} />
      <span className="text-xs sm:text-sm font-bold" style={{ color }}>
        {title}
      </span>
      <span className="text-[10px] sm:text-xs text-center text-zinc-500 leading-tight">
        {description}
      </span>
      {(acceptedFiles ?? fileLimit) && (
        <span className="text-[10px] sm:text-xs text-center text-zinc-400 leading-tight">
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
