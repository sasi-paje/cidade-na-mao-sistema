interface UserAvatarProps {
  name?: string
}

export const UserAvatar = ({ name }: UserAvatarProps = {}) => {
  const initial = name ? name.charAt(0).toUpperCase() : 'A'
  return (
    <div className="flex items-center justify-center rounded-full">
      <div className="bg-[#bdcde8] flex items-center justify-center rounded-full w-[34px] h-[34px]">
        <div className="bg-[#0f3255] flex flex-col items-center justify-center rounded-full w-[24px] h-[24px]">
          <span className="font-normal text-[16px] text-white">{initial}</span>
        </div>
      </div>
    </div>
  )
}
