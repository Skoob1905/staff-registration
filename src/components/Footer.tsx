declare const __APP_VERSION__: string;

export const Footer = () => {
  return (
    <footer
      className="border-t py-3"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "transparent",
        borderImage: "linear-gradient(90deg, #99f6e4, #93c5fd, #99f6e4) 1",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
        <span className="text-[11px] text-[var(--muted-foreground)]">
          Designed &amp; Created by Ruby Digital Services
        </span>
        <span className="text-[11px] text-[var(--muted-foreground)]">
          v{__APP_VERSION__}
        </span>
      </div>
    </footer>
  );
};
