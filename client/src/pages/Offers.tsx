import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingDown, TrendingUp, LogIn, LogOut } from "lucide-react";

export default function Offers() {
  const { user, loading: authLoading, logout } = useAuth();
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [storeId, setStoreId] = useState<number | undefined>();
  const [inStock, setInStock] = useState<boolean | undefined>();
  const [sortBy, setSortBy] = useState<"price" | "date">("price");

  // Queries
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = trpc.offers.list.useQuery({
    minPrice,
    maxPrice,
    storeId,
    inStock,
    limit: 100,
  });

  const { data: stores } = trpc.offers.getStores.useQuery();
  const { mutate: runCrawler, isPending: crawlerPending } = trpc.offers.runCrawler.useMutation();

  // Ordenar ofertas
  const sortedOffers = useMemo(() => {
    if (!offers) return [];
    const sorted = [...offers];
    if (sortBy === "price") {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === "date") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [offers, sortBy]);

  const safeUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "#";
      return url;
    } catch {
      return "#";
    }
  }, []);

  const handleRunCrawler = () => {
    runCrawler(undefined, {
      onSuccess: () => {
        refetchOffers();
      },
    });
  };

  const formatPrice = (centavos: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(centavos / 100);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">PlayStation 5 Pro Tracker</h1>
            <p className="text-muted-foreground">
              Monitore ofertas em tempo real de múltiplos e-commerces brasileiros
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {!authLoading && (user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {user.name ?? user.email}
                </span>
                <Button variant="outline" size="sm" onClick={() => logout()} className="gap-2">
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </>
            ) : (
              <a href="/api/auth/google">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" /> Entrar com Google
                </Button>
              </a>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refine sua busca de ofertas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Preço Mínimo</label>
                <Input
                  type="number"
                  placeholder="R$ 0"
                  value={minPrice ? minPrice / 100 : ""}
                  onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) * 100 : undefined)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Preço Máximo</label>
                <Input
                  type="number"
                  placeholder="R$ 10000"
                  value={maxPrice ? maxPrice / 100 : ""}
                  onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) * 100 : undefined)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Loja</label>
                <Select value={storeId?.toString() || "all"} onValueChange={(val) => setStoreId(val === "all" ? undefined : parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Disponibilidade</label>
                <Select value={inStock === undefined ? "all" : inStock ? "sim" : "nao"} onValueChange={(val) => {
                  if (val === "all") setInStock(undefined);
                  else setInStock(val === "sim");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="sim">Em Estoque</SelectItem>
                    <SelectItem value="nao">Fora de Estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Ordenar por</label>
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as "price" | "date")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Menor Preço</SelectItem>
                    <SelectItem value="date">Mais Recente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={handleRunCrawler} disabled={crawlerPending} variant="default">
                {crawlerPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar Agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {offers && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Ofertas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{offers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Menor Preço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {offers.length > 0 ? formatPrice(Math.min(...offers.map((o) => o.price))) : "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Em Estoque</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{offers.filter((o) => o.inStock).length}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Ofertas */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Ofertas Encontradas</h2>

          {offersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedOffers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nenhuma oferta encontrada com os filtros selecionados</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedOffers.map((offer) => (
                <Card key={offer.id} className="hover:shadow-lg transition-shadow">
                  {offer.imageUrl && (
                    <div className="w-full h-48 bg-muted overflow-hidden rounded-t-lg">
                      <img
                        src={offer.imageUrl}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">{offer.title}</CardTitle>
                        <CardDescription className="text-sm mt-1">ID Loja: {offer.storeId}</CardDescription>
                      </div>
                      {!offer.inStock && (
                        <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                          Fora de Estoque
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-3xl font-bold text-green-600">{formatPrice(offer.price)}</div>
                        {offer.originalPrice && offer.originalPrice > offer.price && (
                          <div className="text-sm text-muted-foreground line-through">
                            {formatPrice(offer.originalPrice)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(offer.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <a
                        href={safeUrl(offer.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block w-full"
                      >
                        <Button className="w-full" variant="outline">
                          Ver Oferta
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
