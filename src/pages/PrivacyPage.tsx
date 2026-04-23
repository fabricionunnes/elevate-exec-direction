import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <Layout>
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">Política de Privacidade</h1>
            <p className="text-body text-lg">
              Como coletamos, usamos, armazenamos e protegemos seus dados pessoais.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-premium p-8 md:p-12 space-y-12">
              <div>
                <h2 className="heading-card text-foreground mb-4">1. Introdução</h2>
                <div className="text-body space-y-4">
                  <p>
                    A UNV — Universidade Nacional de Vendas ("UNV", "nós" ou "nosso") respeita sua privacidade
                    e está comprometida em proteger seus dados pessoais. Esta Política de Privacidade descreve
                    como coletamos, usamos, armazenamos e protegemos as informações fornecidas por você ao
                    utilizar nosso site, plataformas e serviços.
                  </p>
                  <p>
                    Esta política está em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD —
                    Lei nº 13.709/2018)</strong> e demais legislações aplicáveis.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">2. Dados que Coletamos</h2>
                <div className="text-body space-y-4">
                  <p>Podemos coletar os seguintes tipos de dados pessoais:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li><strong>Dados de identificação:</strong> nome, e-mail, telefone, CPF/CNPJ</li>
                    <li><strong>Dados profissionais:</strong> empresa, cargo, segmento de atuação</li>
                    <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas visitadas, tempo de permanência</li>
                    <li><strong>Dados de comunicação:</strong> mensagens enviadas via formulários, WhatsApp ou e-mail</li>
                    <li><strong>Dados financeiros:</strong> informações de pagamento (processadas por gateways seguros)</li>
                    <li><strong>Cookies e tecnologias similares:</strong> para melhorar sua experiência de navegação</li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">3. Como Usamos seus Dados</h2>
                <div className="text-body space-y-4">
                  <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Prestar nossos serviços de direção comercial, treinamento e cobrança</li>
                    <li>Processar diagnósticos comerciais e propostas</li>
                    <li>Enviar comunicações operacionais e administrativas</li>
                    <li>Realizar cobranças e emitir notas fiscais</li>
                    <li>Enviar conteúdo educacional, novidades e materiais relevantes (com seu consentimento)</li>
                    <li>Cumprir obrigações legais e regulatórias</li>
                    <li>Melhorar nossos serviços e a experiência do usuário</li>
                    <li>Prevenir fraudes e garantir a segurança</li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">4. Base Legal para Tratamento</h2>
                <div className="text-body space-y-4">
                  <p>Tratamos seus dados pessoais com base nas seguintes hipóteses legais previstas na LGPD:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li><strong>Consentimento:</strong> quando você autoriza expressamente o uso dos dados</li>
                    <li><strong>Execução de contrato:</strong> para prestação dos serviços contratados</li>
                    <li><strong>Cumprimento de obrigação legal:</strong> para atender exigências fiscais e regulatórias</li>
                    <li><strong>Legítimo interesse:</strong> para melhorias operacionais e segurança</li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">5. Compartilhamento de Dados</h2>
                <div className="text-body space-y-4">
                  <p>
                    A UNV <strong>não vende seus dados pessoais</strong>. Podemos compartilhá-los apenas com:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Prestadores de serviço essenciais (hospedagem, gateways de pagamento, e-mail, WhatsApp)</li>
                    <li>Autoridades públicas, quando exigido por lei ou ordem judicial</li>
                    <li>Parceiros operacionais, somente quando necessário para a execução do serviço</li>
                  </ul>
                  <p>
                    Todos os terceiros são contratualmente obrigados a manter a confidencialidade e segurança
                    dos seus dados.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">6. Armazenamento e Segurança</h2>
                <div className="text-body space-y-4">
                  <p>
                    Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
                    autorizado, perda, alteração ou divulgação indevida, incluindo:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Criptografia de dados em trânsito e em repouso</li>
                    <li>Controles de acesso baseados em função e autenticação</li>
                    <li>Monitoramento contínuo da infraestrutura</li>
                    <li>Backups regulares e planos de continuidade</li>
                  </ul>
                  <p>
                    Seus dados são armazenados pelo tempo necessário para cumprir as finalidades descritas
                    nesta política ou conforme exigido por lei.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">7. Seus Direitos (LGPD)</h2>
                <div className="text-body space-y-4">
                  <p>Como titular dos dados, você tem o direito de:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Confirmar a existência de tratamento dos seus dados</li>
                    <li>Acessar os dados que possuímos sobre você</li>
                    <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
                    <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
                    <li>Revogar o consentimento a qualquer momento</li>
                    <li>Solicitar a portabilidade dos dados a outro fornecedor</li>
                    <li>Ser informado sobre com quem compartilhamos seus dados</li>
                    <li>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD)</li>
                  </ul>
                  <p>
                    Para exercer seus direitos, entre em contato pelo e-mail:{" "}
                    <a href="mailto:contato@unv.com.br" className="text-primary hover:underline">
                      contato@unv.com.br
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">8. Cookies</h2>
                <div className="text-body space-y-4">
                  <p>
                    Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso
                    do site e personalizar conteúdo. Você pode gerenciar suas preferências de cookies
                    diretamente nas configurações do seu navegador.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">9. Retenção de Dados</h2>
                <div className="text-body space-y-4">
                  <p>
                    Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades
                    descritas, observando os prazos legais de retenção (fiscais, contábeis e regulatórios).
                    Após esse período, os dados são eliminados ou anonimizados de forma segura.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">10. Alterações nesta Política</h2>
                <div className="text-body space-y-4">
                  <p>
                    Podemos atualizar esta Política de Privacidade periodicamente. Recomendamos consultá-la
                    com frequência. Alterações significativas serão comunicadas pelos canais oficiais.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="heading-card text-foreground mb-4">11. Contato — Encarregado de Dados (DPO)</h2>
                <div className="text-body space-y-4">
                  <p>
                    Em caso de dúvidas, solicitações ou reclamações relacionadas ao tratamento dos seus
                    dados pessoais, entre em contato com nosso responsável:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li><strong>Responsável:</strong> Fabrício Nunnes</li>
                    <li>
                      <strong>E-mail:</strong>{" "}
                      <a href="mailto:fabricio@universidadevendas.com.br" className="text-primary hover:underline">
                        fabricio@universidadevendas.com.br
                      </a>
                    </li>
                    <li>
                      <strong>Telefone / WhatsApp:</strong>{" "}
                      <a href="https://wa.me/5531989840003" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        (31) 98984-0003
                      </a>
                    </li>
                    <li><strong>Empresa:</strong> UNV — Universidade Nacional de Vendas</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <p className="text-small mb-6">Última atualização: Abril 2026</p>
              <Link to="/diagnostico">
                <Button variant="premium" size="lg">
                  Aplicar para Diagnóstico
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
