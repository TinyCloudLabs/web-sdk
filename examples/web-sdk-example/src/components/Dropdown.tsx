import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils/utils';

interface IDropdown {
    id: string;
    label: string;
    children: React.ReactNode;
    className?: string;
}

const Dropdown = ({ id, label, children, className }: IDropdown) => {
    const [open, setOpen] = useState(false);

    const verifyClickOutside = (e: any) => {
        if (!document.getElementById(id)?.contains(e.target)) {
            setOpen(false);
        }
    }

    useEffect(() => {
        window.addEventListener('click', verifyClickOutside);
        return () => {
            window.removeEventListener('click', verifyClickOutside);
        }
    }, [id]);

    return (
        <div
            id={id}
            className={cn('relative my-4', className)}
        >
            <div
                className={cn(
                    'flex cursor-pointer items-center justify-between rounded-base border-2 border-border bg-bw p-4 text-text',
                    open && 'rounded-b-none'
                )}
                onClick={() => setOpen(!open)}
            >
                <div className="font-base">{label}</div>
                <div>{open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
            </div>
            
            {open && (
                <div className="absolute z-10 w-full rounded-base rounded-t-none border-2 border-t-0 border-border bg-bw">
                    {children}
                </div>
            )}
        </div>
    );
};

export default Dropdown;