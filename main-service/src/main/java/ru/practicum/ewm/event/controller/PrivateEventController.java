package ru.practicum.ewm.event.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import ru.practicum.ewm.event.dto.*;
import ru.practicum.ewm.event.service.EventService;
import ru.practicum.ewm.exception.BadRequestException;
import ru.practicum.ewm.request.dto.EventRequestStatusUpdateRequest;
import ru.practicum.ewm.request.dto.EventRequestStatusUpdateResult;
import ru.practicum.ewm.request.dto.ParticipationRequestDto;

import javax.validation.Valid;
import javax.validation.constraints.Positive;
import javax.validation.constraints.PositiveOrZero;
import java.util.List;

@RestController
@RequestMapping("/users/{userId}/events")
@RequiredArgsConstructor
@Slf4j
@Validated
public class PrivateEventController {
    private final EventService eventService;

    @GetMapping
    public List<EventShortDto> getUserEvents(
            @PathVariable Long userId,
            @RequestParam(required = false) @PositiveOrZero Integer from,
            @RequestParam(required = false) @Positive Integer size,
            @RequestParam(required = false) String sort) {

        if (from != null && from < 0) {
            throw new BadRequestException("from must be >= 0");
        }

        if (size != null && size <= 0) {
            throw new BadRequestException("size must be > 0");
        }

        int validFrom = from != null ? from : 0;
        int validSize = size != null ? size : 10;

        log.info("GET /users/{}/events - Getting user events", userId);
        return eventService.getUserEvents(userId, validFrom, validSize);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventCreatedDto createEvent(
            @PathVariable Long userId,
            @Valid @RequestBody(required = false) NewEventDto newEventDto) {

        if (newEventDto == null) {
            throw new BadRequestException("Request body is missing");
        }

        log.info("POST /users/{}/events - Creating new event", userId);
        return eventService.createEvent(userId, newEventDto);
    }

    @GetMapping("/{eventId}")
    public EventFullDto getUserEventById(
            @PathVariable Long userId,
            @PathVariable Long eventId) {
        log.info("GET /users/{}/events/{} - Getting user event", userId, eventId);
        return eventService.getUserEventById(userId, eventId);
    }

    @PatchMapping("/{eventId}")
    public EventFullDto updateUserEvent(
            @PathVariable Long userId,
            @PathVariable Long eventId,
            @Valid @RequestBody UpdateEventUserRequest updateRequest) {
        log.info("PATCH /users/{}/events/{} - Updating user event", userId, eventId);
        return eventService.updateUserEvent(userId, eventId, updateRequest);
    }

    @GetMapping("/{eventId}/requests")
    public List<ParticipationRequestDto> getEventRequests(
            @PathVariable Long userId,
            @PathVariable Long eventId) {
        log.info("GET /users/{}/events/{}/requests - Getting event requests", userId, eventId);
        return eventService.getEventRequests(userId, eventId);
    }

    @PatchMapping("/{eventId}/requests")
    public EventRequestStatusUpdateResult updateRequestStatus(
            @PathVariable Long userId,
            @PathVariable Long eventId,
            @Valid @RequestBody EventRequestStatusUpdateRequest updateRequest) {
        log.info("PATCH /users/{}/events/{}/requests - Updating request status", userId, eventId);
        return eventService.updateRequestStatus(userId, eventId, updateRequest);
    }
}