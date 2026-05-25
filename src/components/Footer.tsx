declare const __APP_VERSION__: string;

export const Footer = () => (
  <footer
    className="border-t border-[var(--border)] py-4"
    style={{ backgroundColor: "var(--header-bg)" }}
  >
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-[var(--muted-foreground)]">
      <span>Designed & Created by Bradgate Heath Ltd</span>
      <span>v{__APP_VERSION__}</span>
    </div>
  </footer>
);
