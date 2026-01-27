import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUpload } from "@/components/circle/MediaUpload";

interface AdData {
  name: string;
  ad_type: string;
  title: string;
  content: string;
  media_urls: string[];
  cta_type: string;
  cta_url: string;
  whatsapp_number: string;
}

interface Props {
  data: AdData;
  onChange: (data: AdData) => void;
  objective: string;
}

const adTypes = [
  { value: "sponsored_post", label: "Post Patrocinado" },
  { value: "sponsored_story", label: "Story Patrocinado" },
  { value: "marketplace_ad", label: "Anúncio de Marketplace" },
  { value: "community_ad", label: "Anúncio de Comunidade" },
  { value: "event_ad", label: "Anúncio de Evento" },
];

const ctaTypes = [
  { value: "whatsapp", label: "Falar no WhatsApp" },
  { value: "view_community", label: "Ver Comunidade" },
  { value: "view_listing", label: "Ver Anúncio" },
  { value: "learn_more", label: "Saber Mais" },
  { value: "view_event", label: "Ver Evento" },
];

export function CircleAdsAdForm({ data, onChange, objective }: Props) {
  const handleMediaChange = (media: { url: string; type: string }[]) => {
    onChange({
      ...data,
      media_urls: media.map((m) => m.url),
    });
  };

  const showWhatsAppField = data.cta_type === "whatsapp" || objective === "whatsapp_traffic";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ad-name">Nome do Anúncio</Label>
        <Input
          id="ad-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Ex: Anúncio Principal"
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de Anúncio</Label>
        <Select
          value={data.ad_type}
          onValueChange={(v) => onChange({ ...data, ad_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {adTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-title">Título (opcional)</Label>
        <Input
          id="ad-title"
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="Ex: Descubra como aumentar suas vendas"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-content">Texto do Anúncio</Label>
        <Textarea
          id="ad-content"
          value={data.content}
          onChange={(e) => onChange({ ...data, content: e.target.value })}
          placeholder="Escreva o conteúdo do seu anúncio..."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          {data.content.length}/2000 caracteres
        </p>
      </div>

      {/* Media Upload */}
      <div className="space-y-2">
        <Label>Imagem ou Vídeo</Label>
        <MediaUpload
          media={data.media_urls.map((url) => ({
            url,
            type: url.includes(".mp4") || url.includes(".webm") ? "video" : "image",
          }))}
          onMediaChange={handleMediaChange}
          maxFiles={1}
          folder="circle-ads"
        />
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Botão de Ação (CTA)</Label>
          <Select
            value={data.cta_type}
            onValueChange={(v) => onChange({ ...data, cta_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ctaTypes.map((cta) => (
                <SelectItem key={cta.value} value={cta.value}>
                  {cta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.cta_type !== "whatsapp" && (
          <div className="space-y-2">
            <Label htmlFor="cta-url">URL de Destino</Label>
            <Input
              id="cta-url"
              value={data.cta_url}
              onChange={(e) => onChange({ ...data, cta_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        )}
      </div>

      {showWhatsAppField && (
        <div className="space-y-2">
          <Label htmlFor="whatsapp">Número do WhatsApp</Label>
          <Input
            id="whatsapp"
            value={data.whatsapp_number}
            onChange={(e) => onChange({ ...data, whatsapp_number: e.target.value })}
            placeholder="5511999999999"
          />
          <p className="text-xs text-muted-foreground">
            Inclua o código do país e DDD (ex: 5511999999999)
          </p>
        </div>
      )}

      {/* Preview Label */}
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-xs font-medium text-muted-foreground mb-1">PRÉVIA DO ANÚNCIO</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 bg-background rounded text-[10px] font-medium">
              Conteúdo Patrocinado
            </span>
          </div>
          {data.title && (
            <p className="font-semibold text-sm">{data.title}</p>
          )}
          <p className="text-sm line-clamp-3">{data.content || "Seu texto aparecerá aqui..."}</p>
          {data.media_urls[0] && (
            <div className="aspect-video bg-muted rounded overflow-hidden">
              {data.media_urls[0].includes(".mp4") || data.media_urls[0].includes(".webm") ? (
                <video src={data.media_urls[0]} className="w-full h-full object-cover" />
              ) : (
                <img src={data.media_urls[0]} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
