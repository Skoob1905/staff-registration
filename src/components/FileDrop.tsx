import { type ElementType, useRef, useState } from "react";

interface FileDropProps {
  icon: ElementType;
  title: string;
  description: string;
  color: string;
  acceptedFiles?: string;
  multiple?: boolean;
  onClick?: () => void;
  onFileSelect?: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
}

export const FileDrop = ({
  icon: Icon,
  title,
  description,
  color,
  acceptedFiles,
  multiple,
  onClick,
  onFileSelect,
  onFilesSelect,
}: FileDropProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || !onFileSelect) return;
    onFileSelect(file);
  };

  const handleFiles = (files: FileList | undefined) => {
    if (!files || !onFilesSelect) return;
    onFilesSelect(Array.from(files));
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onFilesSelect) {
      inputRef.current?.click();
    } else if (onFileSelect) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (onFilesSelect || onFileSelect) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (onFilesSelect) {
          handleFiles(e.dataTransfer.files);
        } else {
          handleFile(e.dataTransfer.files[0]);
        }
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
      {(onFileSelect || onFilesSelect) && (
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFiles}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (onFilesSelect) {
              handleFiles(e.target.files ?? undefined);
            } else {
              handleFile(e.target.files?.[0]);
            }
          }}
        />
      )}
    </div>
  );
};
