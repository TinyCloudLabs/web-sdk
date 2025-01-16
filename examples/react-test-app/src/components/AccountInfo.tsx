
interface IAccountInfo {
  address?: string;
  session?: Record<string, any>;
}

const AccountInfo = ({ address, session }: IAccountInfo) => {
  return (
    <div className='AccountInfo'>
      <h2 className='AccountInfo-h2'>
        Account Info
      </h2>
      {
        session?.ens &&
          (
            session?.ens.domain || session?.ens.avatarUrl ||
            session?.ens.ensName || session?.ens.ensAvatarUrl
          ) ?
          <div>
            <b className='AccountInfo-label'>
              ENS
            </b>
            <br />
            <div className='AccountInfo-container'>
              {
                session.ens.avatarUrl || session.ens.ensAvatarUrl ?
                  <img
                    id='ensAvatar'
                    className='AccountInfo-avatar'
                    src={session.ens.avatarUrl ?? session.ens.ensAvatarUrl}
                    alt='ENS avatar'
                  /> :
                  null
              }
              {
                session.ens.domain || session.ens.ensName ?
                  <code
                    id='ensDomain'
                    className='AccountInfo-value'
                  >
                    {session.ens.domain || session.ens.ensName}
                  </code> :
                  null
              }
            </div>
          </div> :
          null
      }
      <p>
        <b className='AccountInfo-label'>
          Address
        </b>
        <br />
        <code
          id='userAddress'
          className='AccountInfo-value'
        >
          {address?.toLowerCase()}
        </code>
      </p>
    </div>
  );
};

export default AccountInfo;