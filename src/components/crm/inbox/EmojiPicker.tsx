import { useMemo, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Seletor de emoji do Atendimento (Fabrício, 21/10/2026: "esse botão de emoji quero que funcione").
// Sem biblioteca: lista própria com palavras em português pra busca. Os usados por último ficam no
// topo (guardado no navegador de quem usa).

type Item = [emoji: string, palavras: string];

const CATEGORIAS: { nome: string; itens: Item[] }[] = [
  {
    nome: "Carinhas",
    itens: [
      ["😀", "sorriso feliz"], ["😃", "sorriso feliz alegre"], ["😄", "sorriso rindo"], ["😁", "sorriso dentes"],
      ["😆", "rindo risada"], ["😅", "rindo suor nervoso"], ["🤣", "rolando de rir kkk"], ["😂", "chorando de rir kkk"],
      ["🙂", "sorriso leve"], ["🙃", "de cabeça pra baixo ironia"], ["😉", "piscadinha"], ["😊", "sorriso timido corado"],
      ["😇", "anjo inocente"], ["🥰", "apaixonado coracoes"], ["😍", "olhos de coracao amei"], ["🤩", "estrela uau incrivel"],
      ["😘", "beijo"], ["😗", "beijo"], ["😚", "beijo"], ["😋", "delicia gostoso"], ["😛", "lingua"], ["😜", "piscando lingua brincadeira"],
      ["🤪", "maluco doido"], ["🤑", "dinheiro"], ["🤗", "abraco"], ["🤭", "ops mao na boca"], ["🤫", "silencio segredo"],
      ["🤔", "pensando duvida hmm"], ["🤐", "boca fechada"], ["🤨", "desconfiado sobrancelha"], ["😐", "neutro serio"],
      ["😑", "sem expressao"], ["😶", "sem boca"], ["😏", "sorriso de lado malicia"], ["😒", "entediado"], ["🙄", "revirando os olhos"],
      ["😬", "constrangido careta"], ["😌", "aliviado"], ["😔", "pensativo triste"], ["😪", "sono"], ["😴", "dormindo"],
      ["😷", "mascara doente"], ["🤒", "febre doente"], ["🤯", "cabeca explodindo chocado"], ["🥳", "festa comemoracao"],
      ["😎", "oculos escuros top"], ["🤓", "nerd"], ["🧐", "monoculo analisando"], ["😕", "confuso"], ["😟", "preocupado"],
      ["🙁", "triste"], ["😮", "surpreso uau"], ["😯", "surpreso"], ["😲", "espantado"], ["😳", "corado envergonhado"],
      ["🥺", "por favor olhos pidoes"], ["😢", "chorando triste"], ["😭", "chorando muito"], ["😱", "grito medo"],
      ["😖", "frustrado"], ["😣", "perseverante"], ["😞", "decepcionado"], ["😓", "suor"], ["😩", "cansado exausto"],
      ["😫", "cansado"], ["🥱", "bocejo sono"], ["😤", "bufando bravo"], ["😡", "bravo raiva"], ["😠", "bravo"], ["🤬", "xingando"],
      ["😈", "diabinho"], ["💀", "caveira morri"], ["🤡", "palhaco"], ["👻", "fantasma"], ["🤖", "robo"],
    ],
  },
  {
    nome: "Gestos",
    itens: [
      ["👍", "joinha positivo ok like"], ["👎", "negativo nao"], ["👏", "palmas parabens"], ["🙌", "maos pra cima comemorar"],
      ["🙏", "por favor obrigado reza gratidao"], ["🤝", "aperto de mao acordo fechado negocio"], ["👊", "soquinho"], ["✊", "punho forca"],
      ["💪", "forca braco bora"], ["👋", "tchau oi aceno"], ["🤙", "me liga"], ["👌", "ok perfeito"], ["✌️", "paz vitoria"],
      ["🤞", "dedos cruzados torcendo"], ["🤟", "amor"], ["🤘", "rock"], ["👉", "apontando direita"], ["👈", "apontando esquerda"],
      ["👆", "apontando cima"], ["👇", "apontando baixo"], ["☝️", "um minuto atencao"], ["✋", "mao pare"], ["🫶", "coracao com as maos"],
      ["🫡", "continencia sim senhor"], ["🤷", "sei la tanto faz"], ["🤦", "facepalm"], ["🙋", "eu levantando a mao"], ["🙆", "ok"],
      ["🙅", "nao"], ["💁", "informacao"], ["🧠", "cerebro ideia"], ["👀", "olhos olhando"], ["🗣️", "falando"],
    ],
  },
  {
    nome: "Corações",
    itens: [
      ["❤️", "coracao amor vermelho"], ["🧡", "coracao laranja"], ["💛", "coracao amarelo"], ["💚", "coracao verde"],
      ["💙", "coracao azul"], ["💜", "coracao roxo"], ["🖤", "coracao preto"], ["🤍", "coracao branco"], ["🤎", "coracao marrom"],
      ["💔", "coracao partido"], ["❣️", "coracao exclamacao"], ["💕", "coracoes"], ["💞", "coracoes girando"], ["💓", "coracao batendo"],
      ["💗", "coracao crescendo"], ["💖", "coracao brilhando"], ["💘", "flecha cupido"], ["💝", "presente coracao"], ["💯", "cem por cento"],
      ["💥", "explosao"], ["💫", "tonto estrela"], ["💬", "balao conversa"], ["💭", "pensamento"], ["💤", "sono zzz"],
    ],
  },
  {
    nome: "Trabalho",
    itens: [
      ["✅", "check feito confirmado ok certo"], ["☑️", "check"], ["✔️", "certo"], ["❌", "errado x nao"], ["❗", "exclamacao atencao importante"],
      ["❓", "pergunta duvida"], ["⚠️", "atencao aviso alerta"], ["🚨", "alerta urgente sirene"], ["📌", "fixado alfinete"], ["📍", "local endereco"],
      ["📅", "calendario data agenda reuniao"], ["🗓️", "agenda calendario"], ["⏰", "despertador horario"], ["⏳", "ampulheta aguardando prazo"],
      ["⌛", "tempo"], ["🕐", "hora"], ["📞", "telefone ligacao"], ["📱", "celular whatsapp"], ["💻", "computador notebook"],
      ["🖥️", "computador"], ["📧", "email"], ["✉️", "carta envelope"], ["📩", "mensagem recebida"], ["📎", "anexo clipe"],
      ["📄", "documento pagina"], ["📑", "documentos"], ["📝", "anotacao contrato escrever"], ["✍️", "assinatura escrevendo"],
      ["📊", "grafico barras resultado"], ["📈", "grafico subindo crescimento vendas"], ["📉", "grafico caindo queda"], ["🎯", "alvo meta foco"],
      ["🏆", "trofeu campeao vitoria"], ["🥇", "medalha primeiro lugar ouro"], ["🥈", "segundo lugar prata"], ["🥉", "terceiro lugar bronze"],
      ["🚀", "foguete decolar crescimento"], ["🔥", "fogo top quente"], ["⭐", "estrela"], ["🌟", "estrela brilhante"], ["✨", "brilho novidade"],
      ["⚡", "raio rapido energia"], ["💡", "ideia lampada"], ["🔑", "chave"], ["🔒", "cadeado seguro"], ["🔗", "link"],
      ["🔔", "sino notificacao"], ["📢", "megafone anuncio"], ["📣", "megafone"], ["🎉", "festa parabens comemoracao"], ["🎊", "confete"],
      ["🎁", "presente brinde"], ["🛒", "carrinho compra"], ["🏢", "empresa predio escritorio"], ["🏠", "casa"], ["🚗", "carro"],
      ["✈️", "aviao viagem"], ["📦", "caixa pacote entrega"], ["🔄", "atualizar repetir"], ["➡️", "seta direita"], ["⬅️", "seta esquerda"],
      ["⬆️", "seta cima"], ["⬇️", "seta baixo"], ["1️⃣", "um 1"], ["2️⃣", "dois 2"], ["3️⃣", "tres 3"], ["🆗", "ok"], ["🆕", "novo"],
    ],
  },
  {
    nome: "Dinheiro",
    itens: [
      ["💰", "dinheiro saco grana"], ["💵", "dinheiro nota dolar"], ["💸", "dinheiro voando gasto"], ["💳", "cartao credito pagamento"],
      ["🧾", "recibo nota fiscal comprovante"], ["🏦", "banco"], ["🪙", "moeda"], ["💎", "diamante premium"], ["🤑", "dinheiro carinha"],
      ["📈", "lucro crescimento"], ["🏷️", "etiqueta preco"], ["🛍️", "sacolas compras"],
    ],
  },
  {
    nome: "Natureza e comida",
    itens: [
      ["☀️", "sol bom dia"], ["🌙", "lua boa noite"], ["⭐", "estrela"], ["🌈", "arco iris"], ["☁️", "nuvem"], ["🌧️", "chuva"],
      ["❄️", "neve frio"], ["🌹", "rosa flor"], ["🌻", "girassol flor"], ["🌷", "tulipa flor"], ["🌱", "planta crescer"], ["🍀", "trevo sorte"],
      ["🐶", "cachorro"], ["🐱", "gato"], ["🦁", "leao"], ["🐝", "abelha"], ["☕", "cafe"], ["🍺", "cerveja"], ["🍻", "brinde cerveja"],
      ["🥂", "brinde champanhe"], ["🍷", "vinho"], ["🍕", "pizza"], ["🍔", "hamburguer"], ["🍰", "bolo"], ["🎂", "aniversario bolo"],
      ["🍫", "chocolate"], ["🍎", "maca"], ["🥩", "carne churrasco"], ["⚽", "futebol bola"], ["🏋️", "academia treino"], ["🎵", "musica"],
    ],
  },
];

const RECENTES_KEY = "nexus.inbox.emojis-recentes";
const lerRecentes = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENTES_KEY) || "[]").slice(0, 16); } catch { return []; }
};
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EmojiPicker({ onPick, onClose, className }: { onPick: (emoji: string) => void; onClose?: () => void; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const buscaRef = useRef<HTMLInputElement>(null);

  const escolher = (e: string) => {
    onPick(e);
    const novos = [e, ...recentes.filter((r) => r !== e)].slice(0, 16);
    setRecentes(novos);
    try { localStorage.setItem(RECENTES_KEY, JSON.stringify(novos)); } catch { /* navegador sem storage: segue sem recentes */ }
  };

  const grupos = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) {
      return [...(recentes.length ? [{ nome: "Usados por último", itens: recentes.map((e) => [e, ""] as Item) }] : []), ...CATEGORIAS];
    }
    const vistos = new Set<string>();
    const achados = CATEGORIAS.flatMap((c) => c.itens).filter(([e, p]) => {
      if (vistos.has(e) || !q.split(/\s+/).every((t) => semAcento(p).includes(t))) return false;
      vistos.add(e);
      return true;
    });
    return [{ nome: achados.length ? "Resultado" : "Nenhum emoji encontrado", itens: achados }];
  }, [busca, recentes]);

  return (
    <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) { setBusca(""); onClose?.(); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", aberto ? "text-primary bg-primary/10" : "text-muted-foreground", className)}
          title="Emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-2"
        // abre com o foco na busca (o clique no botão puxava o foco de volta pra ele) e, ao
        // fechar, quem devolve o cursor pra caixa de mensagem é o onClose
        onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => buscaRef.current?.focus(), 30); }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Input
          ref={buscaRef}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar emoji (ex.: joinha, coração, festa)"
          className="h-8 mb-2 text-sm"
        />
        <div className="max-h-64 overflow-y-auto pr-1">
          {grupos.map((g) => (
            <div key={g.nome} className="mb-2">
              <div className="text-[11px] font-medium text-muted-foreground px-1 mb-1">{g.nome}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {g.itens.map(([e]) => (
                  <button
                    key={`${g.nome}-${e}`}
                    type="button"
                    onClick={() => escolher(e)}
                    className="h-8 w-8 rounded-md text-xl leading-none hover:bg-muted flex items-center justify-center"
                    title={e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
