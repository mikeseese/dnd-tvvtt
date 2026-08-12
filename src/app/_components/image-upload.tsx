"use client";

import { useState, type JSX } from "react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label: string;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  label,
  className = "",
}: ImageUploadProps): JSX.Element {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-medium text-[var(--color-text-muted)]">
        {label}
      </label>
      {value && (
        <div className="relative w-24 h-24">
          <img
            src={value}
            alt={label}
            className="w-24 h-24 rounded-lg object-cover border border-[var(--color-border)]"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-xs flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--color-text-primary)] file:cursor-pointer"
      />
      {uploading && (
        <span className="text-xs text-[var(--color-text-subtle)]">
          Uploading...
        </span>
      )}
    </div>
  );
}
