import { cn } from '../utils/utils';

interface TitleProps {
    className?: string;
}

const Title = ({ className }: TitleProps) => {
    return (
        <div className={cn('flex flex-col items-center my-6', className)}>
            <div className="relative mb-5 inline-block w-full max-w-2xl">
                <a href="https://tinycloud.xyz/protocol">
                <img
                    src="/tinycloudheader.png"
                    alt="TinyCloud"
                    className="w-full rounded-base border-2 border-border bg-bw shadow-shadow"
                />
                </a>
            </div>
            <h1 className="text-3xl font-heading text-text mb-2">
                TinyCloud Web SDK Example App
            </h1>
            <h2 className="text-sm text-text/70 max-w-2xl text-center px-8">
                Play with TinyCloud Web SDK! Use <a
                    className="font-bold underline"
                    target="_blank"
                    href="https://eips.ethereum.org/EIPS/eip-5573" rel="noreferrer"
                >
                    enhanced Sign-in with Ethereum
                </a>{' '} to give permission to this app to access your TinyCloud storage. Currently, TinyCloud acts as a key-value store controlled by your Ethereum account, but more features are coming soon. To learn more about TinyCloud Protocol, visit <a className="font-bold underline" target="_blank" rel="noopener noreferrer" href="https://tinycloud.xyz/protocol">tinycloud.xyz</a>.
            </h2>
        </div>
    );
};

export default Title;