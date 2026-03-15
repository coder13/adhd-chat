import { Link } from 'react-router-dom';

function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Registration</h1>
        <p className="text-gray-600 mb-6">
          This app relies on your Matrix homeserver&apos;s SSO flow. Create your
          account with the homeserver provider, then come back here to sign in.
        </p>
        <Link
          to="/login"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default Register;
