import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Zap, BarChart3, Bell, LogIn, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();

  const features = [
    {
      icon: <TrendingDown className="h-8 w-8" />,
      title: "Rastreamento de Preços",
      description: "Monitore o preço do PS5 Pro em múltiplos e-commerces em tempo real",
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Atualizações Automáticas",
      description: "Crawler atualiza automaticamente a cada hora com as últimas ofertas",
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Histórico de Preços",
      description: "Visualize como os preços variam ao longo do tempo",
    },
    {
      icon: <Bell className="h-8 w-8" />,
      title: "Filtros Avançados",
      description: "Filtre por preço, loja, disponibilidade e data de descoberta",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header com auth */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 flex justify-end items-center gap-3">
        {loading ? null : user ? (
          <>
            <span className="text-sm text-muted-foreground">Olá, {user.name ?? user.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()} className="gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </>
        ) : (
          <a href="/api/auth/google">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-4 w-4" />
              Entrar com Google
            </Button>
          </a>
        )}
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            PlayStation 5 Pro Tracker
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Encontre as melhores ofertas de PlayStation 5 Pro em e-commerces brasileiros.
            Monitore preços em tempo real e nunca perca uma oportunidade.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/offers")}
            className="text-lg px-8 py-6"
          >
            Ver Ofertas Agora
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="text-primary">{feature.icon}</div>
                  <div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Stats Section */}
        <div className="bg-card rounded-lg border p-8 md:p-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Como Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">1</div>
              <h3 className="font-semibold mb-2">Crawler Automático</h3>
              <p className="text-muted-foreground">
                Sistema executa a cada hora para buscar ofertas em múltiplos e-commerces
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <h3 className="font-semibold mb-2">Detecção de Duplicatas</h3>
              <p className="text-muted-foreground">
                Identifica e elimina ofertas duplicadas para manter a lista limpa
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">3</div>
              <h3 className="font-semibold mb-2">Histórico Completo</h3>
              <p className="text-muted-foreground">
                Registra variações de preço para análise de tendências
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Acesse a lista completa de ofertas e encontre o melhor preço
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/offers")}
            variant="outline"
            className="text-lg px-8 py-6"
          >
            Explorar Ofertas
          </Button>
        </div>
      </div>
    </div>
  );
}
