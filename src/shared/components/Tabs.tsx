export type TabId = string

export interface Tab {
  id: TabId
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
}

const SECONDARY_DEFAULT = '#e67c26'
const PRIMARY_DARK = '#161a36'

export const Tabs = ({ tabs, activeTab, onTabChange }: TabsProps) => {
  return (
    <div className="bg-white flex items-center justify-between w-full">
      <div className="flex flex-[1_0_0] gap-[8px] h-full items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex h-full items-center justify-center px-[16px] py-[8px] relative shrink-0 ${
                isActive
                  ? 'border-b-2 border-solid'
                  : ''
              }`}
              style={{
                borderColor: isActive ? SECONDARY_DEFAULT : 'transparent',
              }}
            >
              <span
                className="font-medium leading-[24px] text-[14px] whitespace-nowrap"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: PRIMARY_DARK,
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}