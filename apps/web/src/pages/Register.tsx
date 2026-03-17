import { Link, useLocation } from 'react-router-dom';

function Register() {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Registration</h1>
        <p className="text-gray-600 mb-6">
          Create your account with your Matrix homeserver provider, then return
          here to sign in with either SSO or a password if your homeserver
          supports it.
        </p>
        <Link
          to={
            redirect
              ? `/login?redirect=${encodeURIComponent(redirect)}`
              : '/login'
          }
          className="text-primary-600 hover:text-primary-700 underline"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default Register;
