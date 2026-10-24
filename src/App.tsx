import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import SellerPage from './pages/SellerPage';
import DashboardPage from './pages/DashboardPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ChatPage from './pages/ChatPage';
import SearchPage from './pages/SearchPage';
import ListProductPage from './pages/ListProductPage';
import LoginPage from './pages/LoginPage';

function Router() {
  const { nav } = useApp();

  const renderPage = () => {
    switch (nav.page) {
      case 'home':
        return <HomePage />;
      case 'product':
        return <ProductPage />;
      case 'seller':
        return <SellerPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'chat':
        return <ChatPage />;
      case 'search':
        return <SearchPage />;
      case 'list-product':
        return <ListProductPage />;
      case 'login':
        return <LoginPage />;
      default:
        return <HomePage />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
