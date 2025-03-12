
import { cn } from '../utils/utils';

interface IAccountInfo {
  address?: string;
  session?: Record<string, any>;
  className?: string;
}

const AccountInfo = ({ address, session, className }: IAccountInfo) => {
  return (
    <div className={cn(
      'rounded-base border-2 border-border bg-bw p-4 text-text',
      className
    )}>
      <h2 className="text-xl font-heading mb-4">
        Account Info
      </h2>
      
      {session?.ens &&
        (session?.ens.domain || session?.ens.avatarUrl ||
         session?.ens.ensName || session?.ens.ensAvatarUrl) ? (
        <div className="mb-4">
          <div className="text-sm text-text/70 mb-1">
            ENS
          </div>
          <div className="flex items-center">
            {(session.ens.avatarUrl || session.ens.ensAvatarUrl) && (
              <img
                id="ensAvatar"
                className="w-8 h-8 rounded-full mr-2"
                src={session.ens.avatarUrl ?? session.ens.ensAvatarUrl}
                alt="ENS avatar"
              />
            )}
            {(session.ens.domain || session.ens.ensName) && (
              <code
                id="ensDomain"
                className="font-mono text-sm break-all"
              >
                {session.ens.domain || session.ens.ensName}
              </code>
            )}
          </div>
        </div>
      ) : null}
      
      <div>
        <div className="text-sm text-text/70 mb-1">
          Address
        </div>
        <code
          id="userAddress"
          className="font-mono text-sm break-all"
        >
          {address?.toLowerCase()}
        </code>
      </div>
    </div>
  );
};

export default AccountInfo;