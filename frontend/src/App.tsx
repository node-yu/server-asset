import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Server, FolderOpen, Building2, KeyRound, Database, Activity, LogOut, Cloud, Globe, Shield, Droplet, Cpu, Bell } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import CostAnalysis from './pages/CostAnalysis';
import ServerList from './pages/ServerList';
import IdcRegistry from './pages/IdcRegistry';
import ProjectList from './pages/ProjectList';
import PlatformList from './pages/PlatformList';
import AccountList from './pages/AccountList';
import AwsCost from './pages/AwsCost';
import DoCost from './pages/DoCost';
import LinodeCost from './pages/LinodeCost';
import DomainManager from './pages/DomainManager';
import RenewalReminder from './pages/RenewalReminder';
import Login from './pages/Login';

function App() {
  const { token, isReady, logout } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm fixed h-full z-10">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                云资产管家
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">Server Assets & Finance</p>
            </div>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <div className="px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">主要功能</div>
            <NavItem to="/" icon={LayoutDashboard} label="费用看板" />
            <NavItem to="/dashboard/analysis" icon={Activity} label="智能分析" />
            <NavItem to="/servers" icon={Server} label="服务器列表" />
            <NavItem to="/idc" icon={Database} label="IDC 登记" />
            <NavItem to="/aws-costs" icon={Cloud} label="AWS 费用" />
            <NavItem to="/do-costs" icon={Droplet} label="DO 费用" />
            <NavItem to="/linode-costs" icon={Cpu} label="Linode 费用" />
            <NavItem to="/domains" icon={Globe} label="域名管理" />
            <NavItem to="/reminders" icon={Bell} label="续费提醒" />
            <NavExternalLink href="https://proxy.dulvora.xyz/" icon={Shield} label="代理管理" />
            
            <div className="px-2 mt-6 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">系统配置</div>
            <NavItem to="/projects" icon={FolderOpen} label="项目组管理" />
            <NavItem to="/platforms" icon={Building2} label="平台管理" />
            <NavItem to="/accounts" icon={KeyRound} label="账号管理" />
          </nav>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">Admin</span>
                <span className="text-xs text-slate-500">System Administrator</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="退出登录"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        
        <main className="flex-1 ml-64 overflow-x-hidden bg-slate-50/50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard/analysis" element={<CostAnalysis />} />
            <Route path="/servers" element={<ServerList />} />
            <Route path="/idc" element={<IdcRegistry />} />
            <Route path="/aws-costs" element={<AwsCost />} />
            <Route path="/do-costs" element={<DoCost />} />
            <Route path="/linode-costs" element={<LinodeCost />} />
            <Route path="/domains" element={<DomainManager />} />
            <Route path="/reminders" element={<RenewalReminder />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/platforms" element={<PlatformList />} />
            <Route path="/accounts" element={<AccountList />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
          isActive
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

function NavExternalLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    >
      <Icon size={18} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      {label}
    </a>
  );
}

export default App;
