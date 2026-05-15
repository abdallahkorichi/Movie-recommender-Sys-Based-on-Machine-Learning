import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Recommendations from './pages/Recommendations';
import Library from './pages/Library';
import WatchLater from './pages/WatchLater';
import Profile from './pages/Profile';
import CategoryView from './pages/CategoryView';
import Search from './pages/Search';
import Footer from './components/Footer';
import { Loader } from 'lucide-react';
import ScrollToTop from './components/ScrollToTop';
function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-100 font-sans selection:bg-primary/30">
      <Navbar />
      
      {/* 6rem top margin to account for new 80px fixed navbar */}
      <main className="pt-24 min-h-screen">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          
          {/* Protected Routes */}
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
          <Route path="/recommendations" element={user ? <Recommendations /> : <Navigate to="/login" />} />
          <Route path="/watch-later" element={user ? <WatchLater /> : <Navigate to="/login" />} />
          <Route path="/library" element={user ? <Library /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/search" element={user ? <Search /> : <Navigate to="/login" />} />
          <Route path="/category/:type" element={user ? <CategoryView /> : <Navigate to="/login" />} />
        </Routes>
      </main>
      <ScrollToTop />
      {user && <Footer />}
    </div>
  )
}

export default App;
