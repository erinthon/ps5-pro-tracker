import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, LogIn, LogOut, Star, Store, User, Clock, CalendarDays, Tag, PackageX } from "lucide-react";
import { CATALOG, DEFAULT_ITEM_ID } from "@shared/catalog";

function formatPrice(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StarRating({ rating }: { rating: number }) {
  const stars = rating / 100;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(stars) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{stars.toFixed(1)}</span>
    </div>
  );
}

const STORE_COLORS: Record<string, string> = {
  "Mercado Livre": "bg-yellow-100 text-yellow-800",
  "Amazon Brasil": "bg-orange-100 text-orange-800",
  "Magazine Luiza": "bg-blue-100 text-blue-800",
};

export default function Offers() {
  const { user, loading: authLoading, logout } = useAuth();
  const [selectedItemId, setSelectedItemId] = useState(DEFAULT_ITEM_ID);
  const [lastCrawledItem, setLastCrawledItem] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [storeId, setStoreId] = useState<number | undefined>();
  const [inStock, setInStock] = useState<boolean | undefined>();
  const [sortBy, setSortBy] = useState<"price" | "date">("price");

  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = trpc.offers.list.useQuery({
    minPrice, maxPrice, storeId, inStock, limit: 100,
  });

  const { data: stores } = trpc.offers.getStores.useQuery();
  const { mutate: runCrawler, isPending: crawlerPending } = trpc.offers.runCrawler.useMutation();

  const sortedOffers = useMemo(() => {
    if (!offers) return [];
    const sorted = [...offers];
    if (sortBy === "price") sorted.sort((a, b) => a.price - b.price);
    else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [offers, sortBy]);

  const safeUrl = useCallback((url: string) => {
    try {
      const p = new URL(url);
      return p.protocol === "https:" || p.protocol === "http:" ? url : "#";
    } catch { return "#"; }
  }, []);

  const handleRunCrawler = () => {
    runCrawler({ itemId: selectedItemId }, {
      onSuccess: () => { setLastCrawledItem(selectedItemId); refetchOffers(); },
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">PS5 Pro Tracker</h1>
            <p className="text-muted-foreground">Monitore ofertas em tempo real de múltiplos e-commerces brasileiros</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {!authLoading && (user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:block">{user.name ?? user.email}</span>
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
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Produto</label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Preço Mínimo</label>
                <Input type="number" placeholder="R$ 0"
                  value={minPrice ? minPrice / 100 : ""}
                  onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) * 100 : undefined)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Preço Máximo</label>
                <Input type="number" placeholder="R$ 10000"
                  value={maxPrice ? maxPrice / 100 : ""}
                  onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) * 100 : undefined)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Loja</label>
                <Select value={storeId?.toString() || "all"} onValueChange={(v) => setStoreId(v === "all" ? undefined : parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Disponibilidade</label>
                <Select value={inStock === undefined ? "all" : inStock ? "sim" : "nao"}
                  onValueChange={(v) => setInStock(v === "all" ? undefined : v === "sim")}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="sim">Em Estoque</SelectItem>
                    <SelectItem value="nao">Fora de Estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Ordenar por</label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "price" | "date")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Menor Preço</SelectItem>
                    <SelectItem value="date">Mais Recente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {user?.role === "admin" && (
              <div className="mt-4">
                <Button onClick={handleRunCrawler} disabled={crawlerPending}>
                  {crawlerPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Atualizando...</>
                    : <><RefreshCw className="mr-2 h-4 w-4" />Atualizar Agora</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {offers && offers.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{offers.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Ofertas encontradas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{formatPrice(Math.min(...offers.map((o) => o.price)))}</div>
                <div className="text-sm text-muted-foreground mt-1">Menor preço</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{offers.filter((o) => o.inStock).length}</div>
                <div className="text-sm text-muted-foreground mt-1">Em estoque</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {offers.filter((o) => o.originalPrice && o.originalPrice > o.price).length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Com desconto</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Ofertas Encontradas</h2>

          {offersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedOffers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-1">
                {lastCrawledItem ? (
                  <>
                    <p className="font-medium">Nenhuma oferta encontrada nas lojas</p>
                    <p className="text-sm text-muted-foreground">
                      Nenhum resultado para{" "}
                      <span className="font-mono bg-muted px-1 rounded">
                        {CATALOG.find((i) => i.id === lastCrawledItem)?.label}
                      </span>. Tente novamente mais tarde.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Nenhuma oferta encontrada com os filtros selecionados</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedOffers.map((offer) => {
                const discount = offer.originalPrice && offer.originalPrice > offer.price
                  ? Math.round((1 - offer.price / offer.originalPrice) * 100)
                  : null;
                const storeColor = STORE_COLORS[offer.storeName ?? ""] ?? "bg-muted text-muted-foreground";

                return (
                  <Card key={offer.id} className={`relative flex flex-col transition-shadow overflow-hidden ${
                    discount
                      ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-100 hover:shadow-xl hover:shadow-emerald-200"
                      : "hover:shadow-lg"
                  }`}>

                    {/* Faixa de desconto no topo do card */}
                    {discount && (
                      <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 shrink-0" />
                    )}

                    {/* Imagem */}
                    <div className={`relative w-full h-44 bg-muted overflow-hidden shrink-0 ${!offer.imageUrl && !discount ? "hidden" : ""}`}>
                      {offer.imageUrl && (
                        <img
                          src={offer.imageUrl}
                          alt={offer.title}
                          className="w-full h-full object-contain p-2"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                        />
                      )}
                      {/* Badge flutuante de desconto sobre a imagem */}
                      {discount && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-sm font-black px-2.5 py-1 rounded-full shadow-md leading-none">
                          -{discount}%
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col flex-1 p-4 gap-3">

                      {/* Badges: loja + estoque */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {offer.storeName && (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${storeColor}`}>
                            <Store className="h-3 w-3" />
                            {offer.storeName}
                          </span>
                        )}
                        {offer.inStock ? (
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            Em Estoque
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            <PackageX className="h-3 w-3" /> Fora de Estoque
                          </span>
                        )}
                      </div>

                      {/* Título */}
                      <h3 className="font-semibold text-sm leading-snug line-clamp-3">{offer.title}</h3>

                      {/* Vendedor */}
                      {offer.sellerName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Vendido por <span className="font-medium text-foreground">{offer.sellerName}</span></span>
                        </div>
                      )}

                      {/* Avaliação */}
                      {offer.rating != null && (
                        <div className="flex items-center gap-2">
                          <StarRating rating={offer.rating} />
                          {offer.reviewCount != null && (
                            <span className="text-xs text-muted-foreground">
                              ({offer.reviewCount.toLocaleString("pt-BR")} avaliações)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Preço */}
                      <div className="mt-auto">
                        <div className={`text-2xl font-bold ${discount ? "text-emerald-600" : "text-green-600"}`}>
                          {formatPrice(offer.price)}
                        </div>
                        {offer.originalPrice && offer.originalPrice > offer.price && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground line-through">
                              {formatPrice(offer.originalPrice)}
                            </span>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              você economiza {formatPrice(offer.originalPrice - offer.price)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Datas */}
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground border-t pt-2">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          <span>Encontrado em {formatDate(offer.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Atualizado {formatDateTime(offer.lastSeen)}</span>
                        </div>
                      </div>

                      {/* CTA */}
                      <a href={safeUrl(offer.url)} target="_blank" rel="noopener noreferrer" className="block">
                        <Button className="w-full" variant="outline" size="sm">
                          Ver Oferta →
                        </Button>
                      </a>

                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
