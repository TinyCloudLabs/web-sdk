import React, { useState } from 'react';
import { Download, Trash2, Folder, File, FileText, Image, Film, Music, Archive, Code } from 'lucide-react';
import { cn } from '../../utils/utils';

interface FileItem {
  type: 'file' | 'folder';
  name: string;
  size?: number;
  path: string;
  modified?: string;
  mimeType?: string;
}

interface NeoBrutalFileItemProps {
  item: FileItem;
  onSelect: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onDownload?: (item: FileItem) => void;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  animateOnHover?: boolean;
  brutal?: boolean;
}

const getFileIcon = (filename: string, size: 'sm' | 'md' | 'lg' = 'md') => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  const iconClass = cn(sizeClasses[size], 'neo-transition');
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff'].includes(ext)) {
    return <Image className={cn(iconClass, 'neo-text-blue')} />;
  } else if (['mp4', 'avi', 'mov', 'webm', 'mkv', 'flv', 'wmv'].includes(ext)) {
    return <Film className={cn(iconClass, 'neo-text-neutral')} />;
  } else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
    return <Music className={cn(iconClass, 'neo-text-blue')} />;
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return <Archive className={cn(iconClass, 'neo-text-neutral')} />;
  } else if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'rs', 'swift'].includes(ext)) {
    return <Code className={cn(iconClass, 'neo-text-blue')} />;
  } else if (['txt', 'doc', 'docx', 'pdf', 'md', 'rtf', 'odt'].includes(ext)) {
    return <FileText className={cn(iconClass, 'neo-text-primary')} />;
  }
  
  return <File className={cn(iconClass, 'neo-text-secondary')} />;
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};


const NeoBrutalFileItem: React.FC<NeoBrutalFileItemProps> = ({ 
  item, 
  onSelect, 
  onDelete, 
  onDownload,
  className,
  compact = false,
  showActions = true,
  animateOnHover = true,
  brutal = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const iconSize = compact ? 'sm' : 'md';

  return (
    <div
      className={cn(
        'cursor-pointer group relative bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all duration-150 rounded-lg p-4 dark:bg-gray-800 dark:border-white dark:shadow-[2px_2px_0px_0px_#fff]',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(item)}
    >
      {/* File Icon Container */}
      <div className="flex flex-col items-center space-y-3">
        <div className={cn(
          'flex items-center justify-center rounded border-2 border-black shadow-[1px_1px_0px_0px_#000] transition-all',
          compact ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12 sm:w-16 sm:h-16 lg:w-18 lg:h-18',
          item.type === 'folder' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
          'dark:border-white dark:shadow-[1px_1px_0px_0px_#fff]'
        )}>
          {item.type === 'folder' ? (
            <Folder className={cn(
              compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-6 h-6 sm:w-8 sm:h-8 lg:w-9 lg:h-9'
            )} />
          ) : (
            getFileIcon(item.name, iconSize)
          )}
        </div>

        {/* File Name */}
        <div className="text-center w-full space-y-1">
          <h3 className={cn(
            'font-semibold line-clamp-2 break-words text-black dark:text-white',
            compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base lg:text-lg'
          )}>
            {item.name}
          </h3>

          {/* File Info */}
          <div className="space-y-1">
            <p className={cn(
              compact ? 'text-xs' : 'text-xs sm:text-sm lg:text-base',
              'text-gray-600 dark:text-gray-400'
            )}>
              {item.type === 'folder' ? 'Folder' : formatSize(item.size || 0)}
            </p>
            
            {/* File Extension Badge */}
            {item.type === 'file' && (
              <div className="flex justify-center">
                <span className="inline-block px-2 py-1 rounded-sm text-xs font-semibold uppercase bg-gray-200 text-gray-700 border border-black dark:bg-gray-600 dark:text-gray-200 dark:border-white">
                  {item.name.split('.').pop() || 'FILE'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className={cn(
          'absolute -top-2 -right-2 flex gap-1 transition-all',
          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}>
          {item.type === 'file' && onDownload && (
            <button
              className="w-7 h-7 flex items-center justify-center bg-blue-500 border border-black shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all text-white rounded dark:border-white dark:shadow-[1px_1px_0px_0px_#fff]"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(item);
              }}
            >
              <Download className="w-3 h-3" />
            </button>
          )}
          
          <button
            className="w-7 h-7 flex items-center justify-center bg-red-500 border border-black shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all text-white rounded dark:border-white dark:shadow-[1px_1px_0px_0px_#fff]"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export const NeoFileItemCompact = (props: Omit<NeoBrutalFileItemProps, 'compact'>) => (
  <NeoBrutalFileItem compact={true} {...props} />
);

export const NeoFileItemBrutal = (props: Omit<NeoBrutalFileItemProps, 'brutal'>) => (
  <NeoBrutalFileItem brutal={true} {...props} />
);

export const NeoFileItemStatic = (props: Omit<NeoBrutalFileItemProps, 'animateOnHover'>) => (
  <NeoBrutalFileItem animateOnHover={false} {...props} />
);

export const NeoFileItemMinimal = (props: Omit<NeoBrutalFileItemProps, 'showActions'>) => (
  <NeoBrutalFileItem showActions={false} {...props} />
);

interface NeoFileGridProps {
  items: FileItem[];
  onSelect: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onDownload?: (item: FileItem) => void;
  className?: string;
  compact?: boolean;
  brutal?: boolean;
  maxColumns?: 2 | 3 | 4 | 5 | 6 | 8;
}

export const NeoFileGrid: React.FC<NeoFileGridProps> = ({
  items,
  onSelect,
  onDelete,
  onDownload,
  className,
  compact = false,
  brutal = false,
  maxColumns = 6
}) => {
  // Mobile-first responsive grid system: 2→3→4→5→6→8 columns
  const getResponsiveGridClasses = () => {
    const baseClass = 'grid';
    const gapClass = 'gap-3 sm:gap-4 md:gap-5 lg:gap-6';
    
    switch (maxColumns) {
      case 2:
        return `${baseClass} ${gapClass} grid-cols-1 xs:grid-cols-2`;
      case 3:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3`;
      case 4:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`;
      case 5:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`;
      case 6:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`;
      case 8:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8`;
      default:
        return `${baseClass} ${gapClass} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`;
    }
  };

  return (
    <div className={cn(
      getResponsiveGridClasses(),
      className
    )}>
      {items.map((item, index) => (
        <NeoBrutalFileItem
          key={`${item.path}-${index}`}
          item={item}
          onSelect={onSelect}
          onDelete={onDelete}
          onDownload={onDownload}
          compact={compact}
          brutal={brutal}
          animateOnHover={true}
        />
      ))}
    </div>
  );
};

interface NeoEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const NeoEmptyState: React.FC<NeoEmptyStateProps> = ({
  title = "No Files Found",
  description = "This folder is empty. Start by uploading some files or creating a new folder.",
  icon = <Folder className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20" />,
  action,
  className
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 text-center',
      className
    )}>
      <div className="mb-4 sm:mb-6 lg:mb-8 neo-text-secondary neo-fade-in">
        {icon}
      </div>
      
      <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-2 sm:mb-3 neo-text-primary">
        {title}
      </h2>
      
      <p className="text-sm sm:text-base lg:text-lg neo-text-secondary mb-6 sm:mb-8 max-w-xs sm:max-w-md lg:max-w-lg">
        {description}
      </p>
      
      {action && (
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {action}
        </div>
      )}
    </div>
  );
};

export { NeoBrutalFileItem };
export default NeoBrutalFileItem;