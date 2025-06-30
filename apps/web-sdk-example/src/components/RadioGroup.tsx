import { RadioGroup as ShadcnRadioGroup, RadioOption } from './ui/radio-group';

interface IRadioGroup {
    label?: string;
    name: string;
    options: Array<string>;
    value: string;
    onChange: (option: string) => void;
    inline?: boolean;
    className?: string;
}

const RadioGroup = ({ 
    label, 
    name, 
    options, 
    value, 
    onChange, 
    inline = true,
    className
}: IRadioGroup) => {
    // Transform string options to RadioOption format
    const radioOptions: RadioOption[] = options.map(option => ({
        value: option,
        label: option
    }));

    return (
        <ShadcnRadioGroup
            label={label}
            name={name}
            options={radioOptions}
            value={value}
            onChange={onChange}
            inline={inline}
            className={className}
        />
    );
};

export default RadioGroup;