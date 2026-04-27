import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Film, User, LogOut, Flame, Heart, Compass, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add scroll listener for transparent-to-solid background transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  const navLinks = [
    { name: 'Home', path: '/', icon: Film },
    { name: 'For You', path: '/recommendations', icon: Compass },
    { name: 'My List', path: '/library', icon: Heart },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
        isScrolled 
            ? 'bg-background/95 backdrop-blur-xl border-b border-slate-800 shadow-xl' 
            : 'bg-gradient-to-b from-background/90 via-background/60 to-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Dynamic Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-all duration-300 overflow-hidden bg-slate-900 border border-slate-700/50">
             <img src="/Auraflix_logo.png" alt="AuraFlix Logo" className="w-full h-full object-cover scale-[1.15]" />
          </div>
          <span className="text-white font-bold text-2xl tracking-tighter group-hover:text-slate-200 transition-colors">
             Aura<span className="text-primary font-black">Flix</span>
          </span>
        </Link>

        {/* Center Nav Links with Framer Motion Micro-Animations */}
        {user && (
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              const Icon = link.icon;
              return (
                <Link 
                  key={link.path} 
                  to={link.path}
                  className="relative group flex items-center gap-2 py-2"
                >
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary/70'}`} />
                  <span className={`text-sm font-semibold tracking-wide transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                    {link.name}
                  </span>
                  
                  {isActive && (
                      <motion.div 
                        layoutId="nav-indicator"
                        className="absolute -bottom-[21px] left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-accent rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.5)]"
                      />
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Right Side Auth & Actions Dropdown */}
        <div className="flex items-center gap-6">
          {user ? (
            <>
              {/* Premium Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative group/search hidden md:block">
                <div className="flex items-center bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-colors rounded-full px-4 py-1.5 focus-within:bg-slate-800 focus-within:border-primary/50 focus-within:shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                  <Search className="w-4 h-4 text-slate-400 group-focus-within/search:text-primary transition-colors" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Movie..."
                    className="bg-transparent border-none outline-none text-sm text-slate-200 ml-3 w-48 focus:w-64 transition-all duration-300 placeholder-slate-500"
                  />
                </div>
              </form>

              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
                >
                    <div className="flex flex-col text-right hidden sm:flex">
                        <span className="text-sm font-bold text-white">{user.name.split(' ')[0]}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Member</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 shadow-inner flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                        <User className="w-5 h-5 text-slate-300" />
                    </div>
                </button>

                {/* Dropdown Menu Component */}
                <AnimatePresence>
                    {showProfileMenu && (
                        <motion.div 
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute right-0 mt-4 w-48 bg-surface/95 backdrop-blur-3xl border border-slate-700/50 rounded-2xl shadow-2xl py-2 z-50 origin-top-right"
                        >
                            <Link to="/profile" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">
                                <User className="w-4 h-4 text-primary" />
                                Account Settings
                            </Link>
                            <div className="h-px bg-slate-700/80 my-1 mx-4" />
                            <button onClick={() => { logout(); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-accent hover:text-red-400 hover:bg-accent/10 transition-colors">
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
                <Link to="/register" className="hidden sm:flex items-center justify-center text-sm font-bold text-slate-300 px-5 py-2 rounded-full hover:text-white hover:bg-slate-800/50 transition-colors">
                    Register
                </Link>
                <Link to="/login" className="flex items-center justify-center text-sm font-bold bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:-translate-y-0.5">
                    Sign In
                </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
