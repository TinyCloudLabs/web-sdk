import { Input as ShadcnInput } from './ui/input';
import { cn } from '../utils/utils';

interface IInput {
    label: string;
    value: string;
    onChange: (value: string) => void;
    helperText?: string;
    className?: string;
}

const Input = ({ label, value, onChange, helperText, className }: IInput) => {
    return (
        <div className={cn('space-y-1', className)}>
            <ShadcnInput
                label={label}
                id={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {helperText && (
                <p className="text-xs text-text/70">
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default Input;