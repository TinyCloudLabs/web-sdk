import { Button as ShadcnButton } from './ui/button';

interface IButton {
    id?: string;
    className?: string;
    children: React.ReactNode;
    onClick: (e: any) => void;
    loading?: boolean;
    variant?: 'default' | 'noShadow' | 'link' | 'neutral' | 'reverse';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = ({ 
    id, 
    className, 
    children, 
    onClick, 
    loading,
    variant = 'default',
    size = 'default'
}: IButton) => {
    return (
        <ShadcnButton
            id={id}
            className={className}
            onClick={!loading ? onClick : () => {}}
            loading={loading}
            variant={variant}
            size={size}
        >
            {children}
        </ShadcnButton>
    )
};

export default Button;