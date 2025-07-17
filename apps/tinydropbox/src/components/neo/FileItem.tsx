import React, { useState } from 'react';
import { Download, Trash2, Folder, File, FileText, Image, Film, Music, Archive, Code } from 'lucide-react';
import { cn } from '../../utils/utils';
import { NeoBrutalButton } from './Button';
import { NeoBrutalCard } from './Card';

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

const getFileTypeColor = (item: FileItem) => {
  if (item.type === 'folder') return 'neo-bg-blue';
  
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return 'neo-bg-blue-light';
  } else if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) {
    return 'neo-bg-neutral';
  } else if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return 'neo-bg-blue-light';
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'neo-bg-neutral';
  } else if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) {
    return 'neo-bg-blue-light';
  }
  
  return 'neo-bg-secondary';
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

  const fileTypeColor = getFileTypeColor(item);
  const iconSize = compact ? 'sm' : 'md';
  const cardSize = compact ? 'sm' : 'md';

  return (
    <NeoBrutalCard
      variant="default"
      size={cardSize}
      shadow={brutal ? 'lg' : 'md'}
      animation={animateOnHover ? 'hover' : 'none'}
      className={cn(
        'cursor-pointer group relative',
        'neo-transition',
        isHovered && 'neo-shadow-lg',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(item)}
    >
      {/* File Icon Container */}
      <div className="flex flex-col items-center space-y-3">
        <div className={cn(
          'flex items-center justify-center neo-rounded neo-border neo-transition',
          compact ? 'w-12 h-12' : 'w-16 h-16',
          fileTypeColor,
          item.type === 'folder' ? 'neo-text-inverse' : 'neo-text-primary'
        )}>
          {item.type === 'folder' ? (
            <Folder className={cn(compact ? 'w-6 h-6' : 'w-8 h-8')} />
          ) : (
            getFileIcon(item.name, iconSize)
          )}
        </div>

        {/* File Name */}
        <div className="text-center w-full space-y-1">
          <h3 className={cn(
            'neo-body font-semibold line-clamp-2 break-words',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {item.name}
          </h3>

          {/* File Info */}
          <div className="space-y-1">
            <p className={cn(
              'neo-small',
              compact ? 'text-xs' : 'text-sm',
              'neo-text-secondary'
            )}>
              {item.type === 'folder' ? 'Folder' : formatSize(item.size || 0)}
            </p>
            
            {/* File Extension Badge */}
            {item.type === 'file' && (
              <div className="flex justify-center">
                <span className={cn(
                  'inline-block px-2 py-1 neo-rounded-sm text-xs font-semibold uppercase',
                  'neo-border neo-bg-secondary neo-text-primary',
                  'neo-transition'
                )}>
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
          'absolute -top-2 -right-2 flex gap-1 neo-transition',
          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}>
          {item.type === 'file' && onDownload && (
            <NeoBrutalButton
              variant="primary"
              size="icon"
              className="w-7 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(item);
              }}
            >
              <Download className="w-3 h-3" />
            </NeoBrutalButton>
          )}
          
          <NeoBrutalButton
            variant="neutral"
            size="icon"
            className="w-7 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </NeoBrutalButton>
        </div>
      )}

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-blue-100/30 neo-rounded pointer-events-none"></div>
      )}
    </NeoBrutalCard>
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
  columns?: 2 | 3 | 4 | 5 | 6;
}

export const NeoFileGrid: React.FC<NeoFileGridProps> = ({
  items,
  onSelect,
  onDelete,
  onDownload,
  className,
  compact = false,
  brutal = false,
  columns = 4
}) => {
  const gridClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  };

  return (
    <div className={cn(
      'grid neo-gap-md',
      `grid-cols-1 sm:grid-cols-2 md:${gridClasses[columns]}`,
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
  icon = <Folder className="w-16 h-16" />,
  action,
  className
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center neo-p-xl text-center',
      className
    )}>
      <div className="mb-6 neo-text-secondary neo-fade-in">
        {icon}
      </div>
      
      <h2 className="neo-heading mb-2 neo-text-primary">
        {title}
      </h2>
      
      <p className="neo-body neo-text-secondary mb-6 max-w-md">
        {description}
      </p>
      
      {action && (
        <div className="flex flex-col sm:flex-row neo-gap-sm">
          {action}
        </div>
      )}
    </div>
  );
};

export { NeoBrutalFileItem };
export default NeoBrutalFileItem;