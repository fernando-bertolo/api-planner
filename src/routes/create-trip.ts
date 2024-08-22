import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from 'zod';
import { prisma } from "../lib/prisma";
import nodemailer from "nodemailer";
import { getMailClient } from "../lib/mail";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/trips', {
    schema: {
      body: z.object({
        destination: z.string().min(4),
        starts_at: z.coerce.date(),
        ends_at: z.coerce.date(),
        owner_name: z.string(),
        owner_email: z.string().email(),
        emails_to_invite: z.array(z.string().email()),
      })
    }
  }, async (request) => {
    // Pega conteúdo do body
    const { destination, ends_at, starts_at, owner_name, owner_email, emails_to_invite } = request.body

    // Valida as datas
    if (dayjs(starts_at).isBefore(new Date())) {
      throw new ClientError('Invalid trip start date');
    }

    if (dayjs(ends_at).isBefore(starts_at)) {
      throw new ClientError('Invalid trip end date');
    }


    // Salva no banco
    const trip = await prisma.trip.create({
      data: {
        destination,
        starts_at,
        ends_at,
        participants: {
          createMany: {
            data: [
              {
                name: owner_name,
                email: owner_email,
                is_owner: true,
                is_confirmed: true
              },
              ...emails_to_invite.map((email) => {
                return { email }
              })
            ]
          }
        }
      }
    })


    const formattedStartDate = dayjs(starts_at).format("LL");
    const formattedEndDate = dayjs(ends_at).format("LL");

    const confirmationLink = `${env.API_BASE_URL}/trips/${trip.id}/confirm `

    // Realiza o envio de e-mail teste
    const mail = await getMailClient()

    const message = await mail.sendMail({
      from: {
        name: 'Equipe planner',
        address: 'oi@planner',
      },
      to: {
        name: owner_name,
        address: owner_email,
      },
      subject: `Confirma sua viagem para ${destination} em ${formattedStartDate}`,
      html: `
      
      <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
        <p>
          Você solicitou a criação de uma viagem para <strong>${destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.
        </p>
        <p></p>
        <p>Para confirmar sua viagem, clique no link abaixo:</p>
        <p></p>
        <p>
          <a href="${confirmationLink}">Confirmar viagem</a>
        </p>
        <p></p>
        <p>
          Caso você não saiva doque se trata este e-mail, apenas ignore este e-mail.
        </p>
    </div>

      
      
      `.trim() //Tira os espaços desnecessários
    })

    console.log(nodemailer.getTestMessageUrl(message))

    return { TripId: trip.id }
  })


}