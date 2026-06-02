package ru.practicum.ewm.request.mapper;

import ru.practicum.ewm.event.model.Event;
import ru.practicum.ewm.request.dto.ParticipationRequestDto;
import ru.practicum.ewm.request.model.Request;
import ru.practicum.ewm.request.model.RequestStatus;
import ru.practicum.ewm.user.model.User;

import java.time.LocalDateTime;

public class RequestMapper {

    public static Request toRequest(User requester, Event event, RequestStatus status) {
        return Request.builder()
                .created(LocalDateTime.now())
                .requester(requester)
                .event(event)
                .status(status)
                .build();
    }

    public static ParticipationRequestDto toParticipationRequestDto(Request request) {
        if (request == null) return null;
        return ParticipationRequestDto.builder()
                .id(request.getId())
                .created(request.getCreated())
                .event(request.getEvent().getId())
                .requester(request.getRequester().getId())
                .status(request.getStatus().toString())
                .build();
    }
}