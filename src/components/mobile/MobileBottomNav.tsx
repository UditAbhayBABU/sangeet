import { Home, Search, ListMusic, ShieldCheck, Sliders } from 'lucide-react';

export type MobileTab = 'home' | 'search' | 'queue' | 'settings';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
  userRole: 'staff' | 'admin';
  queueCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  userRole,
  queueCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:max-w-md md:left-1/2 md:-translate-x-1/2 z-40 bg-[#030303]/95 backdrop-blur-2xl border-t border-[#212121] px-3 h-16 pb-safe flex items-center justify-around select-none">
      {/* 1. HOME Tab */}
      <button
        onClick={() => onChangeTab('home')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'home' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5px] text-[#ff0000]' : 'stroke-[1.8px]'}`} />
        <span className={`text-[10px] tracking-tight ${activeTab === 'home' ? 'font-bold text-white' : 'font-medium'}`}>
          Home
        </span>
      </button>

      {/* 2. SEARCH Tab */}
      <button
        onClick={() => onChangeTab('search')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'search' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Search className={`w-5 h-5 ${activeTab === 'search' ? 'stroke-[2.5px] text-[#ff0000]' : 'stroke-[1.8px]'}`} />
        <span className={`text-[10px] tracking-tight ${activeTab === 'search' ? 'font-bold text-white' : 'font-medium'}`}>
          Search
        </span>
      </button>

      {/* 4. UP NEXT / QUEUE Tab */}
      <button
        onClick={() => onChangeTab('queue')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer relative ${
          activeTab === 'queue' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <div className="relative">
          <ListMusic className={`w-5 h-5 ${activeTab === 'queue' ? 'stroke-[2.5px] text-[#ff0000]' : 'stroke-[1.8px]'}`} />
          {queueCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-[#ff0000] text-white text-[8px] font-bold flex items-center justify-center">
              {queueCount > 9 ? '9+' : queueCount}
            </span>
          )}
        </div>
        <span className={`text-[10px] tracking-tight ${activeTab === 'queue' ? 'font-bold text-white' : 'font-medium'}`}>
          Up Next
        </span>
      </button>

      {/* 5. SETTINGS / ADMIN PA Tab (Only visible if role === 'admin') */}
      {userRole === 'admin' && (
        <button
          onClick={() => onChangeTab('settings')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
            activeTab === 'settings' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <Sliders className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5px] text-[#ff0000]' : 'stroke-[1.8px]'}`} />
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#ff0000] animate-pulse" />
          </div>
          <span className={`text-[10px] tracking-tight ${activeTab === 'settings' ? 'font-bold text-[#ff0000]' : 'font-medium'}`}>
            Broadcast
          </span>
        </button>
      )}
    </nav>
  );
};
