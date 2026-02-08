import { ThemeSwitcher } from "./ThemeSwitcher";

interface HeaderProps {
  address?: string;
}

const Header = ({ address }: HeaderProps) => {
  return (
    <div className="fixed top-0 left-0 z-50 flex w-full items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center">
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          OpenKey Demo
        </span>
      </div>
      <div className="flex items-center gap-4">
        {address && (
          <span className="rounded border border-zinc-200 bg-zinc-100 px-3 py-1.5 font-mono text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
        <ThemeSwitcher />
      </div>
    </div>
  );
};

export default Header;
