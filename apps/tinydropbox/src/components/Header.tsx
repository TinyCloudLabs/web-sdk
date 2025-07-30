import { ThemeSwitcher } from "./ThemeSwitcher";
import { ConnectKitButton } from "connectkit";

const Header = () => {
  return (
    <div className="fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-bw border-b-2 border-border px-6 py-4">
      <div className="flex items-center">
        <img src="/tinycloudsquare.png" alt="TinyCloud" className="h-10 mr-4" />
        <span className="text-2xl font-heading text-text">Tiny Drop Box</span>
      </div>
      <div className="flex items-center gap-4">
        <ConnectKitButton />
        <ThemeSwitcher />
      </div>
    </div>
  );
};

export default Header;
