import { Link } from 'react-router-dom';
import { Film, Mail } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="border-t border-slate-800/60 bg-background/80 backdrop-blur-md mt-16">
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

                    {/* Brand */}
                    <div className="flex flex-col gap-4">
                        <Link to="/" className="flex items-center gap-3 group w-fit">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/50 flex items-center justify-center overflow-hidden">
                                <img src="/Auraflix_logo.png" alt="AuraFlix" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-white font-bold text-xl tracking-tighter">
                                Aura<span className="text-primary font-black">Flix</span>
                            </span>
                        </Link>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                            Discover movies tailored to your taste. Where great movies find you.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-white font-semibold text-sm uppercase tracking-[0.15em] mb-4">Explore</h4>
                        <ul className="space-y-3">
                            {[
                                { label: 'Home', to: '/' },
                                { label: 'For You', to: '/recommendations' },
                                { label: 'My List', to: '/library' },
                                { label: 'Profile', to: '/profile' },
                            ].map(link => (
                                <li key={link.to}>
                                    <Link to={link.to} className="text-slate-400 hover:text-white text-sm transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Categories */}
                    <div>
                        <h4 className="text-white font-semibold text-sm uppercase tracking-[0.15em] mb-4">Categories</h4>
                        <ul className="space-y-3">
                            {[
                                { label: 'Action & Adventure', to: '/category/action' },
                                { label: 'Sci-Fi & Fantasy', to: '/category/scifi' },
                                { label: 'Comedy', to: '/category/comedy' },
                                { label: 'Drama & Thriller', to: '/category/drama' },
                            ].map(link => (
                                <li key={link.to}>
                                    <Link to={link.to} className="text-slate-400 hover:text-white text-sm transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 text-sm">
                        © {new Date().getFullYear()} AuraFlix. Powered by AI.
                    </p>
                    <div className="flex items-center gap-1 text-slate-500">
                        <Film className="w-4 h-4 mr-1 text-primary" />
                        <span className="text-sm">Movie data provided by</span>
                        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-primary hover:text-blue-400 font-semibold ml-1 text-sm transition-colors">TMDB</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
