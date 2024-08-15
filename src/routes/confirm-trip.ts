import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from 'zod';
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";

export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
    schema: {
      params: z.object({
        tripId: z.string().uuid(),
      })
    },
  }, async (request, reply) => {
    const { tripId } = request.params;

    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId,
      },
      include: {
        participants: {
          where: {
            is_owner: false
          }
        }
      }
    })

    if (!trip) {
      throw new Error('Trip not found!!')
    }

    if (trip.is_confirmed) {
      return reply.redirect(`http://localhost:5173/trips/${tripId}`) // Redireciona para o frontend
    }

    await prisma.trip.update({
      where: {
        id: tripId
      },
      data: {
        is_confirmed: true
      },
    })



    const formattedStartDate = dayjs(trip.starts_at).format("LL");
    const formattedEndDate = dayjs(trip.ends_at).format("LL");

    // Realiza o envio de e-mail teste
    const mail = await getMailClient()

    await Promise.all(
      trip.participants.map(async (participant) => {
        const confirmationLink = `http://localhost:3333/participants/${participant.id}/confirm`;

        const message = await mail.sendMail({
          from: {
            name: 'Equipe planner',
            address: 'oi@planner',
          },
          to: participant.email,
          subject: `Confirma sua presença na viagem para ${trip.destination} em ${formattedStartDate}`,
          html: `
          
          <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
            <p>
              Você foi convidado para participar <strong>${trip.destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.
            </p>
            <p></p>
            <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
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
      })
    )

    return reply.redirect(`http://localhost:5173/trips/${tripId}`) // Redireciona para o frontend

  })
}