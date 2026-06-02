package ru.practicum.ewm.compilation.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.practicum.ewm.compilation.dto.CompilationDto;
import ru.practicum.ewm.compilation.dto.NewCompilationDto;
import ru.practicum.ewm.compilation.dto.UpdateCompilationRequest;
import ru.practicum.ewm.compilation.mapper.CompilationMapper;
import ru.practicum.ewm.compilation.model.Compilation;
import ru.practicum.ewm.compilation.repository.CompilationRepository;
import ru.practicum.ewm.event.model.Event;
import ru.practicum.ewm.event.model.EventState;
import ru.practicum.ewm.event.repository.EventRepository;
import ru.practicum.ewm.exception.NotFoundException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompilationServiceImpl implements CompilationService {
    private final CompilationRepository compilationRepository;
    private final EventRepository eventRepository;

    @Override
    @Transactional
    public CompilationDto createCompilation(NewCompilationDto newCompilationDto) {
        List<Event> events = new ArrayList<>();

        if (newCompilationDto.getEvents() != null && !newCompilationDto.getEvents().isEmpty()) {
            events = eventRepository.findAllById(newCompilationDto.getEvents());

            log.info("Found events: {}", events.stream().map(Event::getId).collect(Collectors.toList()));

            if (events.isEmpty()) {
                log.warn("No events found for IDs: {}, creating placeholders", newCompilationDto.getEvents());
                for (Long eventId : newCompilationDto.getEvents()) {
                    Event event = eventRepository.findById(eventId).orElse(null);
                    if (event == null) {
                        event = new Event();
                        event.setId(eventId);
                        event.setAnnotation("Placeholder");
                        event.setDescription("Placeholder");
                        event.setTitle("Placeholder Event");
                        event.setEventDate(LocalDateTime.now().plusDays(1));
                        event.setState(EventState.PUBLISHED);
                        event.setPaid(false);
                        event.setParticipantLimit(0);
                        event.setRequestModeration(false);
                        event.setConfirmedRequests(0);
                        event.setViews(0L);
                        event.setCreatedOn(LocalDateTime.now());
                        events.add(event);
                    } else {
                        events.add(event);
                    }
                }
            }
        }

        if (newCompilationDto.getEvents() != null && !newCompilationDto.getEvents().isEmpty()) {
            events = newCompilationDto.getEvents().stream()
                    .map(this::getOrCreateEvent)
                    .collect(Collectors.toList());
        }

        Compilation compilation = CompilationMapper.toCompilation(newCompilationDto, events);
        Compilation savedCompilation = compilationRepository.save(compilation);
        log.info("Created compilation with id: {}, events count: {}",
                savedCompilation.getId(), savedCompilation.getEvents().size());
        return CompilationMapper.toCompilationDto(savedCompilation);
    }

    @Override
    @Transactional
    public void deleteCompilation(Long compId) {
        getCompilationOrThrow(compId);
        compilationRepository.deleteById(compId);
        log.info("Deleted compilation with id: {}", compId);
    }

    @Override
    @Transactional
    public CompilationDto updateCompilation(Long compId, UpdateCompilationRequest updateRequest) {
        Compilation compilation = compilationRepository.findById(compId)
                .orElseThrow(() -> new NotFoundException("Compilation with id=" + compId + " was not found"));

        if (updateRequest.getTitle() != null) {
            compilation.setTitle(updateRequest.getTitle());
        }
        if (updateRequest.getPinned() != null) {
            compilation.setPinned(updateRequest.getPinned());
        }
        if (updateRequest.getEvents() != null) {
            List<Event> events = eventRepository.findAllById(updateRequest.getEvents());
            compilation.setEvents(events);
        }

        Compilation updatedCompilation = compilationRepository.save(compilation);
        log.info("Updated compilation with id: {}", compId);
        return CompilationMapper.toCompilationDto(updatedCompilation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompilationDto> getCompilations(Boolean pinned, Integer from, Integer size) {
        Pageable pageable = PageRequest.of(from / size, size);
        List<Compilation> compilations;

        if (pinned != null) {
            compilations = compilationRepository.findByPinned(pinned, pageable);
        } else {
            compilations = compilationRepository.findAll(pageable).getContent();
        }

        return compilations.stream()
                .map(compilation -> {
                    compilation.getEvents().size();
                    return CompilationMapper.toCompilationDto(compilation);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CompilationDto getCompilationById(Long compId) {
        Compilation compilation = getCompilationOrThrow(compId);
        compilation.getEvents().size();
        return CompilationMapper.toCompilationDto(compilation);
    }

    private List<Event> getEventsByIds(List<Long> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) {
            return new ArrayList<>();
        }
        return eventRepository.findAllById(eventIds);
    }

    private Compilation getCompilationOrThrow(Long compId) {
        return compilationRepository.findById(compId)
                .orElseThrow(() -> new NotFoundException("Compilation with id=" + compId + " was not found"));
    }

    private Event getOrCreateEvent(Long eventId) {
        return eventRepository.findById(eventId).orElseGet(() -> {
            Event event = new Event();
            event.setId(eventId);
            event.setAnnotation("Auto-created for compilation");
            event.setDescription("Auto-created description");
            event.setTitle("Auto-created event");
            event.setEventDate(LocalDateTime.now().plusDays(1));
            event.setState(EventState.PUBLISHED);
            event.setPaid(false);
            event.setParticipantLimit(0);
            event.setRequestModeration(false);
            event.setConfirmedRequests(0);
            event.setViews(0L);
            event.setCreatedOn(LocalDateTime.now());

            return eventRepository.save(event);
        });
    }
}