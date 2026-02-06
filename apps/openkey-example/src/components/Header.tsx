import { ThemeSwitcher } from './ThemeSwitcher';

interface HeaderProps {
    address?: string;
}

const Header = ({ address }: HeaderProps) => {
    return (
        <div className="fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-bw border-b-2 border-border px-6 py-4">
            <div className="flex items-center">
                <img
                    src="/tinycloudheader.png"
                    alt="TinyCloud"
                    className="h-10 mr-4"
                />
                <span className="text-2xl font-heading text-text">
                    OpenKey Demo
                </span>
            </div>
            <div className="flex items-center gap-4">
                {address && (
                    <span className="text-sm font-mono text-text/70 bg-bg px-3 py-1.5 rounded border border-border">
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                )}
                <ThemeSwitcher />
            </div>
        </div>
    );
};

export default Header;
