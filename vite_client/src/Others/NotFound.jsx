import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 overflow-hidden flex items-center justify-center">
      {/* Background Stars */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(2px 2px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(3px 3px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)), radial-gradient(3px 3px at 160px 120px, #fff, rgba(0,0,0,0))',
        backgroundSize: '200px 200px'
      }}></div>
      
      {/* Floating Planets */}
      <div className="absolute w-20 h-20 rounded-full animate-bounce opacity-70" style={{
        background: 'radial-gradient(circle at 30% 30%, #ff9e9e, #ff3a3a)',
        boxShadow: '0 0 20px rgba(255, 58, 58, 0.6)',
        top: '20%',
        left: '15%',
        animationDuration: '8s'
      }}></div>
      <div className="absolute w-32 h-32 rounded-full animate-bounce opacity-70" style={{
        background: 'radial-gradient(circle at 30% 30%, #9efff9, #00c8ff)',
        boxShadow: '0 0 20px rgba(0, 200, 255, 0.6)',
        top: '60%',
        left: '75%',
        animationDuration: '12s'
      }}></div>
      <div className="absolute w-16 h-16 rounded-full animate-bounce opacity-70" style={{
        background: 'radial-gradient(circle at 30% 30%, #ffe69e, #ffb700)',
        boxShadow: '0 0 20px rgba(255, 183, 0, 0.6)',
        top: '30%',
        left: '80%',
        animationDuration: '10s'
      }}></div>
      
      {/* Astronaut */}
      <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce" style={{ animationDuration: '8s' }}>
        <div className="relative">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-white rounded-full"></div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="text-center px-4 z-10 relative">
        <h1 className="text-8xl md:text-9xl font-bold text-white mb-4 animate-pulse">
          4<span className="text-blue-400">0</span>4
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-8">
          Houston, we have a problem! Page not found.
        </p>
        
        <Link
          to="/"
          className="inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          Beam Me Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;