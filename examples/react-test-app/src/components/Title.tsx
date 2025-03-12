import { cn } from '../utils/utils';

interface TitleProps {
    className?: string;
}

const Title = ({ className }: TitleProps) => {
    return (
        <div className={cn('flex flex-col items-center my-6', className)}>
            <div className="relative mb-5 inline-block w-full max-w-2xl">
                <img 
                    src="/tinycloudheader.png" 
                    alt="TinyCloud" 
                    className="w-full rounded-base border-2 border-border bg-bw shadow-shadow"
                />
            </div>
            <h1 className="text-3xl font-heading text-text mb-2">
                TinyCloud Test App
            </h1>
            <h2 className="text-sm text-text/70 max-w-2xl text-center px-8">
                Play with TinyCloud Web SDK! Currently, it's only a key value store controlled by your Ethereum account, but more features are coming soon.
            </h2>
        </div>
    );
};

export default Title;